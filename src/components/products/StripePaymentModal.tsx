import React from 'react';
import { X } from 'lucide-react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
// import { useSolanaPrice } from '../../utils/price-conversion';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { useWallet } from '../../contexts/WalletContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Button } from '../ui/Button';

// Stripe initialization function
function getStripe(): Promise<Stripe | null> {
  const key = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    console.error('Stripe publishable key is missing from environment variables');
    return Promise.resolve(null);
  }
  return loadStripe(key).catch(err => {
    console.error('Failed to initialize Stripe:', err);
    return null;
  });
}

// CSS variable helper function
function getCssVariable(name: string, fallback: string): string {
  if (typeof window !== 'undefined') {
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue(name).trim() || fallback;
  }
  return fallback;
}

// Type definitions
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
  amount: number;
  productName: string;
  orderId?: string;
  batchOrderId?: string;
  shippingInfo: ShippingInfo;
  couponDiscount?: number;
  originalPrice?: number;
  fee?: number;
}

type PaymentStatus = 'idle' | 'processing' | 'requires_action' | 'succeeded' | 'error';

function StripeCheckoutForm({ 
  amount, 
  onSuccess,
  couponDiscount = 0,
  originalPrice = 0,
  shippingInfo
}: {
  amount: number;
  onSuccess: (paymentIntentId: string, orderId?: string, batchOrderId?: string) => void;
  couponDiscount?: number;
  originalPrice?: number;
  shippingInfo: ShippingInfo;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = React.useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = React.useState<PaymentStatus>('idle');
  const [isPaymentMethodSelected, setIsPaymentMethodSelected] = React.useState(false);
  const [elementsReady, setElementsReady] = React.useState(false);
  const paymentStatusRef = React.useRef<PaymentStatus>('idle');

  // Update ref when status changes
  React.useEffect(() => {
    paymentStatusRef.current = paymentStatus;
  }, [paymentStatus]);

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

  // Payment submission handler
  const handleSubmit = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Payment submission initiated');

    if (!stripe || !elements || paymentStatus === 'processing') {
      console.log('Payment submission blocked:', { 
        hasStripe: !!stripe, 
        hasElements: !!elements, 
        paymentStatus,
        isPaymentMethodSelected
      });
      return;
    }

    // Validate payment form
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
            const paymentMeta = (result.paymentIntent as any).metadata || {};
            
            console.log('Payment metadata from Stripe:', paymentMeta);
            
            const metaOrderId = paymentMeta.orderIdStr;
            const metaBatchOrderId = paymentMeta.batchOrderIdStr;
            
            if (!metaOrderId && !metaBatchOrderId) {
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
            setTimeout(() => {
              if (paymentStatusRef.current === 'processing') {
                setError('Payment is taking longer than expected. Please check your payment status.');
                setPaymentStatus('error');
              }
            }, 30000);
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
  }, [stripe, elements, paymentStatus, onSuccess]);

  // Payment timeout effect
  React.useEffect(() => {
    let timeoutId: number;
    
    if (paymentStatus === 'processing') {
      timeoutId = window.setTimeout(() => {
        setError('Payment is taking longer than expected. Please check your payment status.');
        setPaymentStatus('error');
      }, 30000);
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [paymentStatus]);

  // The amount is already in USD/USDC, so we don't need to multiply by solPrice
  // Just ensure minimum payment amount of $0.50
  const usdAmount = Math.max(amount, 0.50).toFixed(2);
  const isProcessing = paymentStatus === 'processing' || paymentStatus === 'requires_action';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-800/50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-300">Amount:</span>
          <div className="text-right">
            <span className="text-white font-medium">
              ${usdAmount}
            </span>
            {couponDiscount > 0 && originalPrice > 0 && (
              <div className="text-sm">
                <span className="text-gray-400 line-through">${originalPrice.toFixed(2)}</span>
                <span className="text-purple-400 ml-2">Coupon applied</span>
              </div>
            )}
            {amount < 0.50 && (
              <div className="text-sm text-yellow-400">
                Adjusted to minimum payment amount ($0.50)
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-400">
          Payment amount in USD
        </div>
      </div>

      <PaymentElement
        options={{
          layout: 'tabs',
          defaultValues: {
            billingDetails: {
              name: `${shippingInfo?.contact_info?.firstName || ''} ${shippingInfo?.contact_info?.lastName || ''}`.trim(),
              email: shippingInfo?.contact_info?.method === 'email' ? shippingInfo?.contact_info?.value : undefined,
              phone: shippingInfo?.contact_info?.phoneNumber,
              address: {
                line1: shippingInfo?.shipping_address?.address,
                city: shippingInfo?.shipping_address?.city,
                country: shippingInfo?.shipping_address?.country || 'US',
                postal_code: shippingInfo?.shipping_address?.zip
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
  amount,
  productName,
  orderId,
  batchOrderId,
  shippingInfo,
  couponDiscount = 0,
  originalPrice = 0,
  fee = 0,
}: StripePaymentModalProps) {
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [stripePromise, setStripePromise] = React.useState<Promise<Stripe | null> | null>(null);
  const { walletAddress } = useWallet();
  const orderProcessedRef = React.useRef(false);

  // Initialize Stripe
  React.useEffect(() => {
    setStripePromise(getStripe());
  }, []);

  // Session storage helper
  const getCheckoutDataFromStorage = React.useCallback(() => {
    try {
      const storedData = window.sessionStorage.getItem('stripeCheckoutData');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        console.log('Retrieved checkout data from session storage', {
          hasItems: !!parsedData.items?.length,
          hasShippingInfo: !!parsedData.shippingInfo
        });
        return parsedData;
      }
    } catch (err) {
      console.error('Error parsing checkout data from session storage:', err);
    }
    return null;
  }, []);

  // Create payment intent
  React.useEffect(() => {
    if (isLoading || clientSecret || orderProcessedRef.current) return;
    
    async function createPaymentIntent() {
      setIsLoading(true);
      setError(null);
      try {
        const checkoutData = getCheckoutDataFromStorage();
        const finalShippingInfo = checkoutData?.shippingInfo || shippingInfo;
        
        if (!finalShippingInfo?.shipping_address) {
          throw new Error('Shipping information is required');
        }
        
        const existingOrderId = orderId ?? batchOrderId;
        
        if (!existingOrderId) {
          console.error('No existing order ID found');
          throw new Error('No existing order ID found. Please go back and try again.');
        }
        
        console.log('Creating payment intent for', {
          amount,
          productName,
          orderId,
          batchOrderId,
          hasShippingInfo: !!finalShippingInfo,
          walletAddress,
          isCartCheckout: !!checkoutData,
          existingOrderId
        });

        const response = await fetch(`/.netlify/functions/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            productName,
            orderId,
            batchOrderId,
            walletAddress,
            shippingInfo: finalShippingInfo
          }),
        });

        console.log('Payment intent response:', {
          status: response.status,
          statusText: response.statusText
        });

        const responseText = await response.text();
        console.log('Response text:', responseText);
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error('JSON parse error:', e);
          throw new Error(`Invalid JSON response from server: ${responseText}`);
        }

        if (!response.ok) {
          throw new Error(data.error || `HTTP error! status: ${response.status} ${response.statusText}`);
        }

        if (data.error) {
          throw new Error(data.error);
        }

        if (!data.clientSecret) {
          throw new Error('No client secret returned from the server');
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
    
    return () => {
      orderProcessedRef.current = false;
    };
  }, [clientSecret]);

  // Handle successful payment
  const handlePaymentSuccess = React.useCallback((paymentIntentId: string, orderIdFromPayment?: string, batchOrderIdFromPayment?: string) => {
    if (orderProcessedRef.current) return;
    
    orderProcessedRef.current = true;
    
    console.log('Payment successful with payment intent ID:', paymentIntentId);
    console.log('Order ID to pass to parent:', orderIdFromPayment);
    console.log('Batch order ID to pass to parent:', batchOrderIdFromPayment);
    
    if (orderIdFromPayment !== orderId) {
      console.warn('Order ID mismatch detected:', {
        localOrderId: orderId,
        stripeOrderId: orderIdFromPayment
      });
    }

    if (batchOrderIdFromPayment !== batchOrderId) {
      console.warn('Batch Order ID mismatch detected:', {
        localOrderId: batchOrderId,
        stripeOrderId: batchOrderIdFromPayment
      });
    }
    
    onSuccess(paymentIntentId, orderIdFromPayment, batchOrderIdFromPayment);
  }, [onSuccess, orderId, batchOrderId]);

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
                  amount={amount}
                  onSuccess={handlePaymentSuccess}
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