import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Package, Clock, MapPin, AlertCircle, CheckCircle, Truck, Box, Home } from 'lucide-react';
import { getTrackingInfo } from '../services/tracking';
import { OrderTracking } from '../types/orders';
import { format } from 'date-fns';

// Define tracking stages for the progress indicator
const TRACKING_STAGES = [
  { id: 'pending', label: 'Order Confirmed', icon: Package },
  { id: 'confirmed', label: 'Processing', icon: Box },
  { id: 'in_transit', label: 'In Transit', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: Home },
] as const;

// Helper function to get status color and icon
const getStatusInfo = (status: string) => {
  const statusMap: Record<string, { color: string; bgColor: string; icon: typeof Package }> = {
    'pending': { color: 'text-yellow-500', bgColor: 'bg-yellow-50', icon: Clock },
    'confirmed': { color: 'text-blue-500', bgColor: 'bg-blue-50', icon: Package },
    'in_transit': { color: 'text-purple-500', bgColor: 'bg-purple-50', icon: Truck },
    'delivered': { color: 'text-green-500', bgColor: 'bg-green-50', icon: CheckCircle },
    'exception': { color: 'text-red-500', bgColor: 'bg-red-50', icon: AlertCircle },
  };
  return statusMap[status] || { color: 'text-gray-500', bgColor: 'bg-gray-50', icon: Package };
};

// Helper function to get stage progress
const getStageProgress = (status: string) => {
  const stageIndex = TRACKING_STAGES.findIndex(stage => stage.id === status);
  return Math.max(0, stageIndex);
};

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

    // Set up polling for updates every 5 minutes
    const pollInterval = setInterval(fetchTracking, 5 * 60 * 1000);
    return () => clearInterval(pollInterval);
  }, [trackingNumber]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-2/3"></div>
              </div>
              <div>
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border-l-2 border-gray-200 pl-8 pb-8">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 text-red-500 mb-6">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Tracking Error</h1>
            <p className="text-gray-600 max-w-md mx-auto">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 text-gray-500 mb-6">
              <Package className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">No Tracking Information</h1>
            <p className="text-gray-600 max-w-md mx-auto">No tracking information found for this number</p>
          </div>
        </div>
      </div>
    );
  }

  const { color, bgColor, icon: StatusIcon } = getStatusInfo(tracking.status || 'pending');
  const currentStage = getStageProgress(tracking.status || 'pending');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          {/* Header Section */}
          <div className="flex items-center gap-4 mb-8">
            <div className={`p-3 rounded-xl ${bgColor}`}>
              <StatusIcon className={`w-8 h-8 ${color}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tracking Details</h1>
              <p className={`text-sm ${color} font-medium`}>
                {tracking.status_details || tracking.status || 'Pending'}
              </p>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mb-12">
            <div className="relative">
              <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 bg-gray-200 rounded">
                <div 
                  className="h-full bg-blue-500 rounded transition-all duration-500" 
                  style={{ width: `${(currentStage / (TRACKING_STAGES.length - 1)) * 100}%` }}
                />
              </div>
              <div className="relative flex justify-between">
                {TRACKING_STAGES.map((stage, index) => {
                  const isActive = index <= currentStage;
                  const StageIcon = stage.icon;
                  return (
                    <div key={stage.id} className="flex flex-col items-center">
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-300 ${
                          isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        <StageIcon className="w-5 h-5" />
                      </div>
                      <div className="mt-2 text-sm font-medium text-gray-600">{stage.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tracking Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className={`p-6 rounded-xl ${bgColor} transition-all duration-300`}>
              <label className="text-sm text-gray-600 block mb-1">Tracking Number</label>
              <p className="font-bold text-lg">{tracking.tracking_number}</p>
            </div>
            <div className={`p-6 rounded-xl ${bgColor} transition-all duration-300`}>
              <label className="text-sm text-gray-600 block mb-1">Carrier</label>
              <p className="font-bold text-lg uppercase">{tracking.carrier}</p>
            </div>
            {tracking.estimated_delivery_date && (
              <div className={`p-6 rounded-xl ${bgColor} transition-all duration-300 md:col-span-2`}>
                <label className="text-sm text-gray-600 block mb-1">Estimated Delivery</label>
                <p className="font-bold text-lg">
                  {format(new Date(tracking.estimated_delivery_date), 'PPP')}
                </p>
              </div>
            )}
          </div>

          {/* Tracking History */}
          <div>
            <h2 className="text-xl font-bold mb-6">Tracking History</h2>
            {tracking.tracking_events && tracking.tracking_events.length > 0 ? (
              <div className="space-y-6">
                {tracking.tracking_events.map((event, index) => (
                  <div
                    key={event.id}
                    className={`relative pl-8 pb-8 ${
                      index === tracking.tracking_events!.length - 1 ? '' : 'border-l-2 border-blue-200'
                    }`}
                  >
                    <div className="absolute -left-2 w-4 h-4 bg-blue-500 rounded-full shadow-md" />
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="mb-2">
                        <span className="font-bold text-gray-900">{event.status}</span>
                      </div>
                      {event.details && (
                        <p className="text-gray-600 text-sm mb-3">{event.details}</p>
                      )}
                      <div className="flex items-center text-sm text-gray-500 space-x-4">
                        {event.location && (
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            <span>{event.location}</span>
                          </div>
                        )}
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          <span>{format(new Date(event.timestamp), 'PPp')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No tracking events available yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 