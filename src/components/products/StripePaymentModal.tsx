import React from 'react';
import { X } from 'lucide-react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useSolanaPrice } from '../../utils/price-conversion';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { useWallet } from '../../contexts/WalletContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { supabase } from '../../lib/supabase';

// Replace the early initialization with a function
function getStripe() {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    console.error('Stripe publishable key is missing from environment variables');
    return null;
  }
  return loadStripe(key).catch(err => {
    console.error('Failed to initialize Stripe:', err);
    return null;
  });
}

// Type definitions for better type safety
interface ShippingAddress {
  address: string;
  city: string;
  country: string;
  zip: string;
}

interface ContactInfo {
  method: string;
  value: string;
  fullName: string;
  phoneNumber?: string;
}

interface ShippingInfo {
  shipping_address: ShippingAddress;
  contact_info: ContactInfo;
}

interface StripePaymentModalProps {
  onClose: () => void;
  onSuccess: (orderId: string, paymentIntentId: string) => void;
  solAmount: number;
  productName: string;
  productId: string;
  shippingInfo: ShippingInfo;
  variants?: Array<{
    name: string;
    value: string;
  }>;
  couponCode?: string;
  couponDiscount?: number;
  originalPrice?: number;
}

type PaymentStatus = 'idle' | 'processing' | 'requires_action' | 'succeeded' | 'error';

function StripeCheckoutForm({ 
  solAmount, 
  onSuccess,
  couponDiscount,
  originalPrice,
  solPrice,
  shippingInfo
}: {
  solAmount: number;
  onSuccess: (paymentIntentId: string) => void;
  couponDiscount?: number;
  originalPrice?: number;
  solPrice: number;
  shippingInfo: ShippingInfo;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = React.useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = React.useState<PaymentStatus>('idle');
  const [isPaymentMethodSelected, setIsPaymentMethodSelected] = React.useState(false);
  const [elementsReady, setElementsReady] = React.useState(false);
  const paymentStatusRef = React.useRef<PaymentStatus>('idle');
  const submitButtonRef = React.useRef<HTMLButtonElement>(null);

  // Update ref when status changes
  React.useEffect(() => {
    paymentStatusRef.current = paymentStatus;
  }, [paymentStatus]);

  // Effect to check if elements are ready
  React.useEffect(() => {
    if (!elements) return;
    
    const checkElementsReady = async () => {
      try {
        // Get the payment element
        const paymentElement = elements.getElement('payment');
        if (paymentElement) {
          setElementsReady(true);
        }
      } catch (err) {
        console.error('Error checking elements ready state:', err);
      }
    };
    
    checkElementsReady();
  }, [elements]);

  // Handle payment element changes
  const handlePaymentElementChange = React.useCallback((event: any) => {
    console.log('Payment element change:', event);
    setIsPaymentMethodSelected(event.complete);
    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
  }, []);

  // Debounced submit handler to prevent multiple rapid clicks
  const handleSubmit = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Payment submission initiated');

    if (!stripe || !elements || !solPrice || paymentStatus === 'processing') {
      console.log('Payment submission blocked:', { 
        hasStripe: !!stripe, 
        hasElements: !!elements, 
        hasSolPrice: !!solPrice, 
        paymentStatus,
        isPaymentMethodSelected
      });
      return;
    }

    // Check if this is a 100% discounted order - no need to process payment
    const is100PercentDiscount = 
      couponDiscount !== undefined && 
      originalPrice !== undefined && 
      couponDiscount > 0 && 
      (couponDiscount >= originalPrice || (originalPrice > 0 && (couponDiscount / originalPrice) * 100 >= 100));

    if (is100PercentDiscount) {
      console.log('Client-side validation: 100% discounted order detected, payment should be bypassed');
      setError('This order has a 100% discount and should not require payment. Please refresh the page and try again.');
      return;
    }

    // Additional validation to ensure we have a payment method selected
    try {
      const result = await elements.submit();
      if (result.error) {
        setError(result.error.message || 'Please complete all required payment information.');
        return;
      }
    } catch (error) {
      console.error('Error validating payment form:', error);
      setError('Please select a payment method.');
      return;
    }

    setPaymentStatus('processing');
    try {
      console.log('Confirming payment...');
      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required'
      });

      console.log('Payment confirmation result:', result);

      if (result.error) {
        console.error('Payment error:', result.error);
        setError(result.error.message || 'Payment failed');
        setPaymentStatus('error');
      } else if (result.paymentIntent) {
        console.log('Payment intent status:', result.paymentIntent.status);
        switch (result.paymentIntent.status) {
          case 'succeeded':
            setPaymentStatus('succeeded');
            onSuccess(result.paymentIntent.id);
            break;
          case 'processing':
            setPaymentStatus('processing');
            // Add a timeout to check status again
            const timeoutId = window.setTimeout(() => {
              // Use ref to check current status
              if (paymentStatusRef.current === 'processing') {
                setError('Payment is taking longer than expected. Please check your payment status.');
                setPaymentStatus('error');
              }
            }, 30000); // 30 seconds timeout
            return () => window.clearTimeout(timeoutId);
            break;
          case 'requires_payment_method':
            setError('Please provide a valid payment method.');
            setPaymentStatus('idle');
            break;
          case 'requires_confirmation':
            setError('Payment requires confirmation. Please try again.');
            setPaymentStatus('idle');
            break;
          case 'requires_action':
            setPaymentStatus('requires_action');
            break;
          case 'canceled':
            setError('Payment was canceled. Please try again.');
            setPaymentStatus('idle');
            break;
          default:
            setError('Something went wrong with the payment.');
            setPaymentStatus('error');
            break;
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('An unexpected error occurred. Please try again.');
      setPaymentStatus('error');
    }
  }, [stripe, elements, solPrice, paymentStatus, onSuccess]);

  // Add payment status effect
  React.useEffect(() => {
    let timeoutId: number;
    
    if (paymentStatus === 'processing') {
      timeoutId = window.setTimeout(() => {
        setError('Payment is taking longer than expected. Please check your payment status.');
        setPaymentStatus('error');
      }, 30000); // 30 seconds timeout
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [paymentStatus]);

  if (solPrice === 0) {
    return <Loading type={LoadingType.ACTION} text="Loading price data..." />;
  }

  const usdAmount = Math.max(solAmount * solPrice, 0.50).toFixed(2);
  const isProcessing = paymentStatus === 'processing' || paymentStatus === 'requires_action';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-800/50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-300">Amount:</span>
          <div className="text-right">
            <span className="text-white font-medium">
              ${usdAmount} <span className="text-gray-400">({solAmount.toFixed(2)} SOL)</span>
            </span>
            {(couponDiscount ?? 0) > 0 && (originalPrice ?? 0) > 0 && (
              <div className="text-sm">
                <span className="text-gray-400 line-through">${((originalPrice ?? 0) * solPrice).toFixed(2)}</span>
                <span className="text-purple-400 ml-2">Coupon applied</span>
              </div>
            )}
            {solAmount * solPrice < 0.50 && (
              <div className="text-sm text-yellow-400">
                Adjusted to minimum payment amount ($0.50)
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-400">
          Price updated in real-time based on current SOL/USD rate
        </div>
      </div>

      <PaymentElement
        options={{
          layout: 'tabs',
          defaultValues: {
            billingDetails: {
              name: shippingInfo?.contact_info?.fullName,
              email: shippingInfo?.contact_info?.method === 'email' ? shippingInfo?.contact_info?.value : undefined,
              phone: shippingInfo?.contact_info?.phoneNumber,
              address: {
                ...shippingInfo?.shipping_address,
                country: shippingInfo?.shipping_address?.country || 'US'
              }
            }
          },
          paymentMethodOrder: ['card'],
          fields: {
            billingDetails: 'auto'
          }
        }}
        onChange={handlePaymentElementChange}
        onReady={() => setElementsReady(true)}
      />

      {error && (
        <div className="text-red-500 text-sm p-4 bg-red-500/10 rounded-lg">
          {error}
        </div>
      )}

      <button
        ref={submitButtonRef}
        type="submit"
        disabled={isProcessing || !elementsReady || !stripe || !isPaymentMethodSelected}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <Loading type={LoadingType.ACTION} />
            <span>
              {paymentStatus === 'requires_action' 
                ? 'Waiting for confirmation...' 
                : 'Processing payment...'}
            </span>
          </>
        ) : !elementsReady ? (
          <span>Loading payment options...</span>
        ) : (
          <span>Pay ${usdAmount}</span>
        )}
      </button>

      {paymentStatus === 'requires_action' && (
        <div className="text-sm text-gray-400 text-center mt-2">
          Please complete the additional authentication steps in the popup window.
          <button
            type="button"
            onClick={() => setPaymentStatus('idle')}
            className="block w-full mt-2 text-purple-400 hover:text-purple-300"
          >
            Cancel Payment
          </button>
        </div>
      )}
    </form>
  );
}

export function StripePaymentModal({
  onClose,
  onSuccess,
  solAmount,
  productName,
  productId,
  shippingInfo,
  variants,
  couponCode,
  couponDiscount = 0,
  originalPrice = 0
}: StripePaymentModalProps) {
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [stripePromise, setStripePromise] = React.useState<Promise<Stripe | null> | null>(null);
  const { walletAddress } = useWallet();
  const { price: rawSolPrice } = useSolanaPrice();
  const solPrice = rawSolPrice || 0;

  // Initialize Stripe only when modal is opened
  React.useEffect(() => {
    setStripePromise(getStripe());
  }, []);

  // Create payment intent with proper dependency tracking
  React.useEffect(() => {
    if (!solPrice || !shippingInfo?.shipping_address || isLoading || clientSecret) return;
    
    async function createPaymentIntent() {
      setIsLoading(true);
      try {
        // Check if it's a 100% discount - with improved handling for different discount types
        const discountPercentage = originalPrice && originalPrice > 0 
          ? (couponDiscount / originalPrice) * 100 
          : 0;
          
        const is100PercentDiscount = 
          couponDiscount !== undefined && 
          originalPrice !== undefined && 
          couponDiscount > 0 && (
            // Handle fixed SOL discount (equal or greater than original price)
            couponDiscount >= originalPrice ||
            // Handle percentage discount (100% or more)
            discountPercentage >= 100
          );

        console.log('Coupon discount calculation:', {
          couponDiscount,
          originalPrice,
          discountPercentage: discountPercentage.toFixed(2) + '%',
          is100PercentDiscount,
          couponCode
        });

        if (is100PercentDiscount) {
          // For 100% discount, create order directly without payment
          console.log('Creating free order with 100% discount');
          
          const { data: createdOrderId, error: createError } = await supabase.rpc('create_order', {
            p_product_id: productId,
            p_variants: variants || [],
            p_shipping_info: shippingInfo,
            p_wallet_address: walletAddress || 'stripe',
            p_payment_metadata: {
              couponCode,
              originalPrice,
              couponDiscount,
              paymentMethod: 'stripe'
            }
          });

          if (createError) throw createError;

          // Generate unique transaction signature for free orders
          const uniqueSignature = `free_order_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

          // Update order with unique transaction signature for free orders
          const { error: updateError } = await supabase.rpc('update_order_transaction', {
            p_order_id: createdOrderId,
            p_transaction_signature: uniqueSignature,
            p_amount_sol: 0
          });

          if (updateError) throw updateError;

          // Confirm the order immediately since it's free
          const { error: confirmError } = await supabase.rpc('confirm_order_transaction', {
            p_order_id: createdOrderId
          });

          if (confirmError) throw confirmError;

          // Call onSuccess with the order ID and unique signature
          onSuccess(createdOrderId, uniqueSignature);
          return;
        }

        console.log('Creating payment intent:', {
          endpoint: `${API_BASE_URL}${API_ENDPOINTS.createPaymentIntent}`,
          solAmount,
          solPrice,
          productName,
          productId,
          couponCode,
          couponDiscount
        });

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.createPaymentIntent}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            solAmount,
            solPrice,
            productName,
            productId,
            variants,
            walletAddress,
            shippingInfo,
            couponCode,
            couponDiscount,
            originalPrice,
            paymentMetadata: {
              couponCode,
              originalPrice,
              couponDiscount,
              paymentMethod: 'stripe'
            }
          }),
        });

        console.log('Payment intent response:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });

        let data;
        let responseText;
        try {
          responseText = await response.text();
          console.log('Response text:', responseText);
          
          try {
            data = JSON.parse(responseText);
          } catch (e) {
            console.error('JSON parse error:', e);
            throw new Error(`Invalid JSON response from server: ${responseText}`);
          }
        } catch (err) {
          console.error('Network or parsing error:', err);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
          }
          throw new Error('Failed to connect to payment server');
        }

        if (!response.ok) {
          console.error('Response not OK:', {
            status: response.status,
            data
          });
          
          // Handle specific error cases
          if (data.details?.includes('must be at least $0.50 usd')) {
            throw new Error('The payment amount after discount is too low. Minimum payment amount is $0.50 USD.');
          }
          
          throw new Error(data.error || `Failed to create payment intent (${response.status})`);
        }

        if (!data.clientSecret) {
          console.error('Missing client secret in response:', data);
          throw new Error('No client secret received from server');
        }

        setClientSecret(data.clientSecret);
        setOrderId(data.orderId);
      } catch (err) {
        console.error('Error creating payment intent:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize payment');
      } finally {
        setIsLoading(false);
      }
    }

    createPaymentIntent();
  }, [
    solPrice, 
    shippingInfo?.shipping_address, 
    isLoading, 
    clientSecret,
    solAmount,
    productName,
    productId,
    variants,
    walletAddress,
    couponCode,
    couponDiscount,
    originalPrice
  ]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/80 backdrop-blur-lg overflow-y-auto">
      <div className="relative max-w-lg w-full bg-gray-900 rounded-xl p-6 my-8">
        <div className="p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-white">Credit Card Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
          {error ? (
            <div className="text-red-500 p-4 text-center">
              {error}
              <button
                onClick={() => {
                  setError(null);
                  setClientSecret(null);
                  setOrderId(null);
                }}
                className="mt-4 text-purple-400 hover:text-purple-300 text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          ) : !clientSecret || !orderId ? (
            <div className="flex items-center justify-center p-8">
              <Loading type={LoadingType.ACTION} text="Initializing payment..." />
            </div>
          ) : !stripePromise ? (
            <div className="text-red-500 p-4 text-center">
              <div className="mb-2">Failed to initialize payment provider.</div>
              <div className="text-sm text-gray-400 mb-4">Please try refreshing the page.</div>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 text-purple-400 hover:text-purple-300 text-sm font-medium block w-full"
              >
                Refresh Page
              </button>
            </div>
          ) : (
            <Elements 
              stripe={stripePromise} 
              options={{
                clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#9333ea',
                    colorBackground: '#111827',
                    colorText: '#ffffff',
                    colorDanger: '#ef4444',
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                  },
                  rules: {
                    '.Input': {
                      color: '#ffffff'
                    },
                    '.Label': {
                      color: '#ffffff'
                    },
                    '.Tab': {
                      color: '#ffffff'
                    }
                  }
                },
                loader: 'always'
              }}
            >
              <ErrorBoundary
                fallback={
                  <div className="text-red-500 p-4 text-center">
                    <div className="mb-2">Failed to load payment form.</div>
                    <div className="text-sm text-gray-400 mb-4">Please try refreshing the page.</div>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-4 text-purple-400 hover:text-purple-300 text-sm font-medium block w-full"
                    >
                      Refresh Page
                    </button>
                  </div>
                }
              >
                <StripeCheckoutForm
                  solAmount={solAmount}
                  onSuccess={(paymentIntentId) => onSuccess(orderId, paymentIntentId)}
                  couponDiscount={couponDiscount}
                  originalPrice={originalPrice}
                  solPrice={solPrice}
                  shippingInfo={shippingInfo}
                />
              </ErrorBoundary>
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
} 