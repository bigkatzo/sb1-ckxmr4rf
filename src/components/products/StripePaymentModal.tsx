import React from 'react';
import { X } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
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
import { ErrorBoundary } from 'react-error-boundary';

// Initialize Stripe with proper error handling
const stripePromise = (() => {
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    console.error('Stripe publishable key is missing from environment variables');
    return null;
  }
  return loadStripe(key).catch(err => {
    console.error('Failed to initialize Stripe:', err);
    return null;
  });
})();

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
}

type PaymentStatus = 'idle' | 'processing' | 'requires_action' | 'succeeded' | 'error';

function StripeCheckoutForm({ 
  solAmount, 
  onSuccess
}: {
  solAmount: number;
  onSuccess: (paymentIntentId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = React.useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = React.useState<PaymentStatus>('idle');
  const paymentStatusRef = React.useRef<PaymentStatus>('idle');
  const { price: solPrice, loading: priceLoading, error: priceError } = useSolanaPrice();
  const submitButtonRef = React.useRef<HTMLButtonElement>(null);

  // Update ref when status changes
  React.useEffect(() => {
    paymentStatusRef.current = paymentStatus;
  }, [paymentStatus]);

  // Debounced submit handler to prevent multiple rapid clicks
  const handleSubmit = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !solPrice || paymentStatus === 'processing') {
      console.log('Payment submission blocked:', { 
        hasStripe: !!stripe, 
        hasElements: !!elements, 
        hasSolPrice: !!solPrice, 
        paymentStatus 
      });
      return;
    }

    setPaymentStatus('processing');
    try {
      console.log('Confirming payment...');
      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
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

  if (priceLoading) {
    return <Loading type={LoadingType.ACTION} text="Loading price data..." />;
  }

  if (priceError || !solPrice) {
    return (
      <div className="text-red-500 p-4 text-center">
        Failed to load price data. Please try again later.
      </div>
    );
  }

  const usdAmount = (solAmount * solPrice).toFixed(2);
  const isProcessing = paymentStatus === 'processing' || paymentStatus === 'requires_action';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-800/50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-300">Amount:</span>
          <span className="text-white font-medium">
            ${usdAmount} <span className="text-gray-400">({solAmount} SOL)</span>
          </span>
        </div>
        <div className="text-xs text-gray-400">
          Price updated in real-time based on current SOL/USD rate
        </div>
      </div>

      <PaymentElement />

      {error && (
        <div className="text-red-500 text-sm p-4 bg-red-500/10 rounded-lg">
          {error}
        </div>
      )}

      <button
        ref={submitButtonRef}
        type="submit"
        disabled={isProcessing}
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
}: StripePaymentModalProps) {
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = React.useState(false);
  const { price: solPrice } = useSolanaPrice();
  const { walletAddress } = useWallet();

  // Create payment intent with proper dependency tracking
  React.useEffect(() => {
    if (!solPrice || !shippingInfo?.shipping_address || isCreatingOrder || clientSecret) return;
    
    const amount = solAmount * solPrice;

    async function createPaymentIntent() {
      setIsCreatingOrder(true);
      try {
        console.log('Creating payment intent:', {
          endpoint: `${API_BASE_URL}${API_ENDPOINTS.createPaymentIntent}`,
          amount,
          productName,
          productId
        });

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.createPaymentIntent}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            amount,
            productName,
            productId,
            variants,
            walletAddress,
            shippingInfo,
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
        setIsCreatingOrder(false);
      }
    }

    createPaymentIntent();
  }, [
    solPrice, 
    shippingInfo?.shipping_address, 
    isCreatingOrder, 
    clientSecret,
    solAmount,
    productName,
    productId,
    variants,
    walletAddress
  ]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/80 backdrop-blur-lg">
      <div className="relative max-w-lg w-full bg-gray-900 rounded-xl p-6">
        <div className="p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Credit Card Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
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
                />
              </ErrorBoundary>
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
} 