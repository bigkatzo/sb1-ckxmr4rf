import { useState } from 'react';
import { useCreateTracking } from '../hooks/useCreateTracking';
import { Truck, Loader2 } from 'lucide-react';

interface AddTrackingFormProps {
  orderId: string;
  onSuccess: () => void;
}

export function AddTrackingForm({ orderId, onSuccess }: AddTrackingFormProps) {
  const { createTracking, loading, error } = useCreateTracking();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingProvider, setTrackingProvider] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await createTracking({
      tracking_number: trackingNumber,
      tracking_provider: trackingProvider,
      order_id: orderId,
      postal_code: postalCode || undefined,
      destination_country: destinationCountry || undefined,
    });

    if (result) {
      setTrackingNumber('');
      setTrackingProvider('');
      setPostalCode('');
      setDestinationCountry('');
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="tracking_number" className="block text-sm font-medium text-gray-300 mb-1">
          Tracking Number *
        </label>
        <input
          type="text"
          id="tracking_number"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Enter tracking number"
          required
        />
      </div>

      <div>
        <label htmlFor="tracking_provider" className="block text-sm font-medium text-gray-300 mb-1">
          Tracking Provider *
        </label>
        <input
          type="text"
          id="tracking_provider"
          value={trackingProvider}
          onChange={(e) => setTrackingProvider(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="e.g., ups, usps, fedex"
          required
        />
      </div>

      <div>
        <label htmlFor="postal_code" className="block text-sm font-medium text-gray-300 mb-1">
          Postal Code
        </label>
        <input
          type="text"
          id="postal_code"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Enter postal code"
        />
      </div>

      <div>
        <label htmlFor="destination_country" className="block text-sm font-medium text-gray-300 mb-1">
          Destination Country
        </label>
        <input
          type="text"
          id="destination_country"
          value={destinationCountry}
          onChange={(e) => setDestinationCountry(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="e.g., US"
        />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Truck className="h-4 w-4" />
        )}
        Add Tracking
      </button>
    </form>
  );
} 