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

// Initialize Stripe (you'll need to replace with your publishable key)
const STRIPE_KEY = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
console.log('Stripe initialization:', {
  keyExists: !!STRIPE_KEY,
  keyLength: STRIPE_KEY?.length,
  keyPrefix: STRIPE_KEY?.substring(0, 7)
});

// Only initialize Stripe if we have a key
const stripePromise = STRIPE_KEY 
  ? loadStripe(STRIPE_KEY).then(stripe => {
      console.log('Stripe loaded successfully:', !!stripe);
      return stripe;
    }).catch(err => {
      console.error('Failed to initialize Stripe:', err);
      return null;
    })
  : Promise.resolve(null);

interface StripePaymentModalProps {
  onClose: () => void;
  onSuccess: (orderId: string, paymentIntentId: string) => void;
  solAmount: number;
  productName: string;
  productId: string;
  shippingInfo: any; // Replace with your shipping info type
  variants?: any[];
}

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
  const [processing, setProcessing] = React.useState(false);
  const { price: solPrice, loading: priceLoading, error: priceError } = useSolanaPrice();

  // Log stripe and elements availability
  React.useEffect(() => {
    console.log('Stripe form state:', {
      stripeAvailable: !!stripe,
      elementsAvailable: !!elements
    });
  }, [stripe, elements]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    console.log('Submit clicked, checking prerequisites:', {
      stripe: !!stripe,
      elements: !!elements,
      solPrice: !!solPrice
    });

    if (!stripe || !elements || !solPrice) {
      console.log('Missing required objects for payment');
      return;
    }

    setProcessing(true);

    try {
      console.log('Confirming payment...');
      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (result.error) {
        console.error('Payment error:', result.error);
        setError(result.error.message || 'Payment failed');
      } else if (result.paymentIntent?.status === 'succeeded') {
        console.log('Payment succeeded:', result.paymentIntent.id);
        onSuccess(result.paymentIntent.id);
      } else {
        console.log('Payment requires additional actions:', result.paymentIntent?.status);
        // Payment requires additional actions (like 3D Secure)
        // The webhook will handle the success case
        // We'll show a loading state here
        setProcessing(true);
      }
    } catch (err) {
      console.error('Payment submission error:', err);
      setError('Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (priceLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loading type={LoadingType.ACTION} text="Loading price data..." />
      </div>
    );
  }

  if (priceError || !solPrice) {
    return (
      <div className="text-red-500 p-4 text-center">
        Failed to load price data. Please try again later.
      </div>
    );
  }

  const usdAmount = (solAmount * solPrice).toFixed(2);

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
        type="submit"
        disabled={processing}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <Loading type={LoadingType.ACTION} />
            <span>Processing...</span>
          </>
        ) : (
          <span>Pay ${usdAmount}</span>
        )}
      </button>
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
  const { price: solPrice, loading: priceLoading, error: priceError } = useSolanaPrice();
  const { walletAddress } = useWallet();

  // Create payment intent when the modal opens and shipping info is available
  React.useEffect(() => {
    // Don't create a new order if we already have one or are in the process
    if (!solPrice || !shippingInfo?.address || isCreatingOrder || clientSecret) return;
    
    const amount = solAmount * solPrice;

    async function createPaymentIntent() {
      setIsCreatingOrder(true);
      try {
        console.log('Creating payment intent with:', {
          amount,
          productName,
          productId,
          variants,
          walletAddress,
          shippingInfo
        });

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.createPaymentIntent}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount,
            productName,
            productId,
            variants,
            walletAddress,
            shippingInfo: {
              shipping_address: {
                address: shippingInfo.address,
                city: shippingInfo.city,
                country: shippingInfo.country,
                zip: shippingInfo.zip
              },
              contact_info: {
                method: shippingInfo.contactMethod,
                value: shippingInfo.contactValue,
                fullName: shippingInfo.fullName,
                phoneNumber: shippingInfo.phoneNumber
              }
            },
          }),
        });

        const responseText = await response.text();
        console.log('Response from server:', responseText);

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse response:', e);
          throw new Error(`Invalid response from server: ${responseText}`);
        }

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create payment intent');
        }

        if (!data.clientSecret) {
          throw new Error('No client secret received from server');
        }

        console.log('Setting client secret and order ID');
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
  }, [solPrice, shippingInfo?.address, isCreatingOrder, clientSecret]);

  if (priceLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/80 backdrop-blur-lg">
        <div className="relative max-w-lg w-full bg-gray-900 rounded-xl p-6">
          <div className="flex items-center justify-center p-8">
            <Loading type={LoadingType.ACTION} text="Loading price data..." />
          </div>
        </div>
      </div>
    );
  }

  if (priceError || !solPrice) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/80 backdrop-blur-lg">
        <div className="relative max-w-lg w-full bg-gray-900 rounded-xl p-6">
          <div className="text-red-500 p-4 text-center">
            Failed to load price data. Please try again later.
          </div>
        </div>
      </div>
    );
  }

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
          ) : !STRIPE_KEY ? (
            <div className="text-red-500 p-4 text-center">
              <div className="mb-2">Stripe configuration is missing. Please check your environment variables.</div>
              <div className="text-sm text-gray-400">Contact support if this issue persists.</div>
            </div>
          ) : !stripePromise ? (
            <div className="text-red-500 p-4 text-center">
              <div className="mb-2">Failed to initialize payment provider.</div>
              <div className="text-sm text-gray-400 mb-4">Please try refreshing the page.</div>
              <button
                onClick={() => {
                  setError(null);
                  setClientSecret(null);
                  setOrderId(null);
                  window.location.reload();
                }}
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