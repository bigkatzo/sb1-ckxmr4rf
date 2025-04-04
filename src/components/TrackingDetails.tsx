import { useState, useEffect } from 'react';
import { Package, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface TrackingLocation {
  city: string;
  state: string;
  country: string;
  zip: string;
}

interface TrackingEvent {
  message: string;
  status: string;
  status_detail: string;
  datetime: string;
  tracking_location: TrackingLocation;
}

interface TrackingData {
  tracking_number: string;
  tracking_provider: string;
  tracking_event_status: string;
  tracking_est_delivery_date: string | null;
  shipping_service: string;
  last_event_time: string;
  events: TrackingEvent[];
}

interface TrackingDetailsProps {
  trackingNumber: string;
}

export function TrackingDetails({ trackingNumber }: TrackingDetailsProps) {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrackingStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/.netlify/functions/get-tracking-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tracking_number: trackingNumber }),
        });

        const result = await response.json();

        if (result.status === 'error') {
          throw new Error(result.message);
        }

        setTrackingData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tracking status');
      } finally {
        setLoading(false);
      }
    };

    if (trackingNumber) {
      fetchTrackingStatus();
    }
  }, [trackingNumber]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-gray-700 rounded w-3/4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 bg-red-400/10 p-4 rounded-lg">
        <p>{error}</p>
      </div>
    );
  }

  if (!trackingData) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium">Tracking Details</h3>
            <p className="text-sm text-gray-400 mt-1">
              {trackingData.shipping_service}
            </p>
          </div>
          {trackingData.tracking_est_delivery_date && (
            <div className="text-right">
              <p className="text-sm text-gray-400">Estimated Delivery</p>
              <p className="text-sm font-medium">
                {format(new Date(trackingData.tracking_est_delivery_date), 'MMM d, yyyy')}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {trackingData.events.map((event, index) => (
            <div
              key={index}
              className={`relative pl-6 pb-4 ${
                index !== trackingData.events.length - 1 ? 'border-l border-gray-700' : ''
              }`}
            >
              <div className="absolute -left-2 p-1 bg-gray-800 rounded-full">
                {index === 0 ? (
                  <Package className="w-4 h-4 text-purple-400" />
                ) : (
                  <div className="w-2 h-2 bg-gray-600 rounded-full" />
                )}
              </div>

              <div className="flex flex-col">
                <p className="text-sm">{event.message}</p>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(event.datetime), 'MMM d, yyyy h:mm a')}
                  </div>
                  {event.tracking_location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {[
                        event.tracking_location.city,
                        event.tracking_location.state,
                        event.tracking_location.zip,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 