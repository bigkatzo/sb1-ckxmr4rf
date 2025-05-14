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
import { Button } from '../ui/Button';

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

// Near the top of the file, add this function
function getCssVariable(name: string, fallback: string): string {
  if (typeof window !== 'undefined') {
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue(name).trim() || fallback;
  }
  return fallback;
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
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

interface ShippingInfo {
  shipping_address: ShippingAddress;
  contact_info: ContactInfo;
}

interface StripePaymentModalProps {
  onClose: () => void;
  onSuccess: (paymentIntentId: string, orderId?: string, batchOrderId?: string) => void;
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
  onSuccess: (paymentIntentId: string, orderId?: string, batchOrderId?: string) => void;
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
            // The PaymentIntent type doesn't declare metadata, so we need to use type assertion
            const paymentMeta = (result.paymentIntent as any).metadata || {};
            
            // Ensure we properly extract order metadata
            console.log('Payment metadata from Stripe:', paymentMeta);
            
            // Extract orderId and batchOrderId from metadata
            // The server stores these in the metadata when creating the payment intent
            const metaOrderId = paymentMeta.orderId;
            const metaBatchOrderId = paymentMeta.batchOrderId;
            
            if (!metaOrderId) {
              console.warn('No orderId found in payment intent metadata');
            }
            
            onSuccess(
              result.paymentIntent.id, 
              metaOrderId, 
              metaBatchOrderId
            );
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
  }, [stripe, elements, solPrice, paymentStatus, onSuccess, isPaymentMethodSelected, couponDiscount, originalPrice]);

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
                <span className="text-primary-400 ml-2">Coupon applied</span>
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
              name: shippingInfo?.contact_info?.firstName + ' ' + shippingInfo?.contact_info?.lastName,
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

      <Button
        ref={submitButtonRef}
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isProcessing}
        loadingText={paymentStatus === 'requires_action' ? 'Waiting for confirmation...' : 'Processing payment...'}
        disabled={isProcessing || !elementsReady || !stripe || !isPaymentMethodSelected}
        className="w-full"
      >
        {!elementsReady ? 'Loading payment options...' : `Pay $${usdAmount}`}
      </Button>

      {paymentStatus === 'requires_action' && (
        <div className="text-sm text-gray-400 text-center mt-2">
          Please complete the additional authentication steps in the popup window.
          <Button
            type="button"
            variant="link"
            onClick={() => setPaymentStatus('idle')}
            className="block w-full mt-2"
          >
            Cancel Payment
          </Button>
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
  const [stripePromise, setStripePromise] = React.useState<Promise<Stripe | null> | null>(null);
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const isProcessingOrder = false; // Replace the state with a constant since we no longer need to change it
  const { walletAddress } = useWallet();
  const { price: rawSolPrice } = useSolanaPrice();
  const solPrice = rawSolPrice || 0;
  
  // Add a ref to track if a free order has been processed to prevent duplicates
  const orderProcessedRef = React.useRef(false);

  // Initialize Stripe only when modal is opened
  React.useEffect(() => {
    setStripePromise(getStripe());
  }, []);

  // Create payment intent when component mounts
  React.useEffect(() => {
    // Skip if necessary data is missing, already loading, already have clientSecret, or already processing an order
    if (!solPrice || !shippingInfo?.shipping_address || isLoading || clientSecret || isProcessingOrder) return;
    
    // Skip if we've already successfully processed an order in this component lifecycle
    if (orderProcessedRef.current) return;
    
    async function createPaymentIntent() {
      setIsLoading(true);
      setError(null);
      try {
        console.log('Creating payment intent for', {
          solAmount,
          productName,
          productId,
          hasShippingInfo: !!shippingInfo,
          hasVariants: !!(variants && variants.length > 0),
          walletAddress
        });

        // We no longer handle free orders in the Stripe modal
        // They are now handled by the parent component (TokenVerificationModal)
        // This prevents duplicate order creation issues

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
              paymentMethod: 'stripe',
              timestamp: Date.now()
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

        if (data.error) {
          throw new Error(data.error);
        }

        if (!data.clientSecret) {
          throw new Error('No client secret returned from the server');
        }

        // Save orderId from response if available
        if (data.orderId) {
          console.log('Received order ID from payment intent creation:', data.orderId);
          // Store it in component state
          setOrderId(data.orderId);
        } else {
          console.warn('No orderId received from payment intent creation');
        }

        console.log('Setting client secret:', data.clientSecret.substring(0, 10) + '...');
        setClientSecret(data.clientSecret);
      } catch (err) {
        console.error('Error creating payment intent:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    createPaymentIntent();
    
    // Return cleanup function to reset the order processed state when component is unmounted
    return () => {
      orderProcessedRef.current = false;
    };
  }, [solPrice, solAmount, productId, productName, walletAddress, shippingInfo, couponCode, 
      couponDiscount, originalPrice, variants, isLoading, clientSecret, onSuccess, isProcessingOrder]);

  // Handle successful payment - pass orderId if available
  const handlePaymentSuccess = React.useCallback((paymentIntentId: string, orderIdFromPayment?: string, batchOrderIdFromPayment?: string) => {
    // Skip if we've already processed a successful payment
    if (orderProcessedRef.current) return;
    
    // Mark as processed
    orderProcessedRef.current = true;
    
    console.log('Payment successful with payment intent ID:', paymentIntentId);
    console.log('Order ID to pass to parent:', orderIdFromPayment || orderId);
    console.log('Batch order ID to pass to parent:', batchOrderIdFromPayment);
    
    // IMPORTANT: We must use the orderIdFromPayment from Stripe's response
    // If we don't have this, we can fall back to the local state, but this should be avoided
    const finalOrderId = orderIdFromPayment || orderId;
    
    if (!orderIdFromPayment && orderId) {
      console.warn('Using local orderId instead of Stripe orderId - possible mismatch!');
    } else if (!finalOrderId) {
      console.error('No valid order ID available!');
    }
    
    // Call the parent's onSuccess with the payment intent ID and order IDs
    // Use undefined instead of null to match the expected type
    const orderIdParam = finalOrderId === null ? undefined : finalOrderId;
    onSuccess(paymentIntentId, orderIdParam, batchOrderIdFromPayment);
  }, [onSuccess, orderId]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/80 backdrop-blur-lg overflow-y-auto">
      <div className="relative max-w-lg w-full bg-gray-900 rounded-xl p-6 my-8">
        <div className="p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900 z-10">
          <h2 className="text-lg font-semibold text-white">Credit Card Payment</h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white p-2 rounded-lg"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
          {error ? (
            <div className="text-red-500 p-4 text-center">
              {error}
              <Button
                onClick={() => {
                  setError(null);
                  setClientSecret(null);
                }}
                variant="link"
                className="mt-4 text-sm font-medium"
              >
                Try Again
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loading type={LoadingType.ACTION} text="Initializing payment..." />
            </div>
          ) : !stripePromise ? (
            <div className="text-red-500 p-4 text-center">
              <div className="mb-2">Failed to initialize payment provider.</div>
              <div className="text-sm text-gray-400 mb-4">Please try refreshing the page.</div>
              <Button
                onClick={() => window.location.reload()}
                variant="link"
                className="mt-4 text-sm font-medium block w-full"
              >
                Refresh Page
              </Button>
            </div>
          ) : !clientSecret ? (
            <div className="flex items-center justify-center p-8">
              <Loading type={LoadingType.ACTION} text="Preparing payment..." />
            </div>
          ) : (
            <Elements 
              stripe={stripePromise} 
              options={{
                clientSecret: clientSecret,
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: getCssVariable('--color-primary', '#9333ea'),
                    colorBackground: getCssVariable('--color-background', '#111827'),
                    colorText: getCssVariable('--color-text', '#ffffff'),
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
              <ErrorBoundary fallback={
                <div className="p-4 text-red-500 text-center">
                  <p>Failed to load payment form.</p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="link"
                    className="mt-4 text-sm font-medium"
                  >
                    Refresh Page
                  </Button>
                </div>
              }>
                <StripeCheckoutForm 
                  solAmount={solAmount}
                  onSuccess={handlePaymentSuccess}
                  solPrice={solPrice}
                  shippingInfo={shippingInfo}
                  couponDiscount={couponDiscount}
                  originalPrice={originalPrice}
                />
              </ErrorBoundary>
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}