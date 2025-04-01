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

// Initialize Stripe (you'll need to replace with your publishable key)
const stripePromise = loadStripe(process.env.VITE_STRIPE_PUBLISHABLE_KEY!);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !solPrice) {
      return;
    }

    setProcessing(true);

    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (result.error) {
        setError(result.error.message || 'Payment failed');
      } else if (result.paymentIntent?.status === 'succeeded') {
        onSuccess(result.paymentIntent.id);
      } else {
        // Payment requires additional actions (like 3D Secure)
        // The webhook will handle the success case
        // We'll show a loading state here
        setProcessing(true);
      }
    } catch (err) {
      setError('Payment failed. Please try again.');
      console.error('Payment error:', err);
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
        disabled={!stripe || processing}
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
  const { price: solPrice, loading: priceLoading, error: priceError } = useSolanaPrice();

  React.useEffect(() => {
    async function createPaymentIntent() {
      try {
        if (!solPrice) return;

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.createPaymentIntent}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: solAmount * solPrice,
            productName,
            productId,
            variants,
            shippingInfo,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create payment intent');
        }

        const { clientSecret, orderId: responseOrderId } = await response.json();
        setClientSecret(clientSecret);
        setOrderId(responseOrderId);
      } catch (err) {
        console.error('Error creating payment intent:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize payment');
      }
    }

    createPaymentIntent();
  }, [solAmount, solPrice, productName, productId, variants, shippingInfo]);

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
            </div>
          ) : !clientSecret || !orderId ? (
            <div className="flex items-center justify-center p-8">
              <Loading type={LoadingType.ACTION} text="Initializing payment..." />
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
              }}
            >
              <StripeCheckoutForm
                solAmount={solAmount}
                onSuccess={(paymentIntentId) => onSuccess(orderId, paymentIntentId)}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
} 