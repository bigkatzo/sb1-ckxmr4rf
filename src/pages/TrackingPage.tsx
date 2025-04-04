import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Package, Truck, MapPin, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Loading, LoadingType } from '../components/ui/LoadingStates';

interface TrackingInfo {
  tracking_number: string;
  status: string;
  status_details: string;
  location: string;
  estimated_delivery: string;
  timeline: Array<{
    date: string;
    status: string;
    location: string;
    description: string;
  }>;
  order_details: {
    order_number: string;
    product_name: string;
    shipping_address: {
      address: string;
      city: string;
      country: string;
      zip: string;
    };
  };
}

export function TrackingPage() {
  const { trackingNumber } = useParams();
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrackingInfo = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/.netlify/functions/tracking/${trackingNumber}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch tracking information');
        }

        const data = await response.json();
        setTrackingInfo(data);
      } catch (err) {
        console.error('Error fetching tracking info:', err);
        setError(err instanceof Error ? err.message : 'Unable to load tracking information. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (trackingNumber) {
      fetchTrackingInfo();
    }
  }, [trackingNumber]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading type={LoadingType.PAGE} />
      </div>
    );
  }

  if (error || !trackingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Package className="w-12 h-12 text-gray-400 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-200">
            {error || 'Tracking information not found'}
          </h2>
          <p className="text-gray-400">
            Please check your tracking number and try again
          </p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'text-green-400 bg-green-500/10';
      case 'in_transit':
        return 'text-purple-400 bg-purple-500/10';
      case 'out_for_delivery':
        return 'text-blue-400 bg-blue-500/10';
      case 'pending':
        return 'text-yellow-500 bg-yellow-500/10';
      default:
        return 'text-gray-400 bg-gray-500/10';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Status Header */}
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-100">
                Tracking Number: {trackingInfo.tracking_number}
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Order #{trackingInfo.order_details.order_number}
              </p>
            </div>
            <div className={`px-4 py-2 rounded-lg ${getStatusColor(trackingInfo.status)}`}>
              <span className="text-sm font-medium">{trackingInfo.status}</span>
            </div>
          </div>

          {/* Current Status Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-700">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm text-gray-400">Current Location</p>
                <p className="text-sm font-medium text-gray-200">{trackingInfo.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm text-gray-400">Estimated Delivery</p>
                <p className="text-sm font-medium text-gray-200">
                  {trackingInfo.estimated_delivery ? 
                    format(new Date(trackingInfo.estimated_delivery), 'MMM dd, yyyy') :
                    'Pending'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm text-gray-400">Status Details</p>
                <p className="text-sm font-medium text-gray-200">{trackingInfo.status_details}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-6">Tracking History</h2>
          <div className="space-y-6">
            {trackingInfo.timeline.map((event, index) => (
              <div key={index} className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-purple-400' : 'bg-gray-600'}`} />
                  {index !== trackingInfo.timeline.length - 1 && (
                    <div className="w-0.5 h-full bg-gray-600" />
                  )}
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium text-gray-200">{event.status}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(event.date), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{event.location}</p>
                  <p className="text-sm text-gray-300 mt-1">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping Details */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Shipping Details</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-400">Product</p>
              <p className="text-sm font-medium text-gray-200">{trackingInfo.order_details.product_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Delivery Address</p>
              <div className="text-sm font-medium text-gray-200 space-y-1">
                <p>{trackingInfo.order_details.shipping_address.address}</p>
                <p>
                  {trackingInfo.order_details.shipping_address.city}, {trackingInfo.order_details.shipping_address.zip}
                </p>
                <p>{trackingInfo.order_details.shipping_address.country}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 