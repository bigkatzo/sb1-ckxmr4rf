import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Package, Clock } from 'lucide-react';
import { getTrackingInfo } from '../services/tracking';
import { OrderTracking } from '../types/orders';
import { format } from 'date-fns';
import { Loading, LoadingType } from '../components/ui/LoadingStates';

export default function TrackingPage() {
  const { trackingNumber } = useParams<{ trackingNumber: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);

  useEffect(() => {
    async function fetchTracking() {
      if (!trackingNumber) {
        setError('No tracking number provided');
        setLoading(false);
        return;
      }

      try {
        const data = await getTrackingInfo(trackingNumber);
        setTracking(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tracking information');
      } finally {
        setLoading(false);
      }
    }

    fetchTracking();
  }, [trackingNumber]);

  if (loading) {
    return <Loading type={LoadingType.PAGE} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-500 mb-4">Error: {error}</div>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-gray-500">No tracking information found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h1 className="text-2xl font-bold mb-4">Tracking Details</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm text-gray-500">Tracking Number</label>
              <p className="font-medium">{tracking.tracking_number}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Carrier</label>
              <p className="font-medium uppercase">{tracking.carrier}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <p className="font-medium">{tracking.status || 'Pending'}</p>
            </div>
            {tracking.estimated_delivery_date && (
              <div>
                <label className="text-sm text-gray-500">Estimated Delivery</label>
                <p className="font-medium">
                  {format(new Date(tracking.estimated_delivery_date), 'PPP')}
                </p>
              </div>
            )}
          </div>

          {tracking.status_details && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8">
              <p className="text-blue-700">{tracking.status_details}</p>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Tracking History</h2>
            {tracking.tracking_events && tracking.tracking_events.length > 0 ? (
              <div className="space-y-4">
                {tracking.tracking_events.map((event, index) => (
                  <div
                    key={event.id}
                    className={`relative pl-8 pb-8 ${
                      index === tracking.tracking_events!.length - 1 ? '' : 'border-l-2 border-gray-200'
                    }`}
                  >
                    <div className="absolute -left-2 w-4 h-4 bg-blue-500 rounded-full" />
                    <div className="mb-1">
                      <span className="font-medium">{event.status}</span>
                    </div>
                    {event.details && (
                      <p className="text-gray-600 text-sm mb-2">{event.details}</p>
                    )}
                    <div className="flex items-center text-sm text-gray-500 space-x-4">
                      {event.location && (
                        <div className="flex items-center">
                          <Package className="w-4 h-4 mr-1" />
                          <span>{event.location}</span>
                        </div>
                      )}
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        <span>{format(new Date(event.timestamp), 'PPp')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No tracking events available yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 