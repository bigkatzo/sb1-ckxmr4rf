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
    'pending': { color: 'text-yellow-400', bgColor: 'bg-yellow-400/10', icon: Clock },
    'confirmed': { color: 'text-blue-400', bgColor: 'bg-blue-400/10', icon: Package },
    'in_transit': { color: 'text-purple-400', bgColor: 'bg-purple-400/10', icon: Truck },
    'delivered': { color: 'text-green-400', bgColor: 'bg-green-400/10', icon: CheckCircle },
    'exception': { color: 'text-red-400', bgColor: 'bg-red-400/10', icon: AlertCircle },
  };
  return statusMap[status] || { color: 'text-gray-400', bgColor: 'bg-gray-400/10', icon: Package };
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
          <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-6 mb-8 animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <div className="h-4 bg-gray-800 rounded w-1/4 mb-2"></div>
                <div className="h-6 bg-gray-800 rounded w-2/3"></div>
              </div>
              <div>
                <div className="h-4 bg-gray-800 rounded w-1/4 mb-2"></div>
                <div className="h-6 bg-gray-800 rounded w-2/3"></div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-6 bg-gray-800 rounded w-1/4 mb-4"></div>
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border-l-2 border-gray-800 pl-8 pb-8">
                    <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-gray-800 rounded w-1/2"></div>
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
          <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-400/10 text-red-400 mb-6">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Tracking Error</h1>
            <p className="text-gray-400 max-w-md mx-auto">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 rounded-xl border border-gray-800/50 p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800 text-gray-400 mb-6">
              <Package className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">No Tracking Information</h1>
            <p className="text-gray-400 max-w-md mx-auto">No tracking information found for this number</p>
          </div>
        </div>
      </div>
    );
  }

  const { color, bgColor, icon: StatusIcon } = getStatusInfo(tracking.status || 'pending');
  const currentStage = getStageProgress(tracking.status || 'pending');

  return (
    <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4 sm:p-6 lg:p-8 mb-8 backdrop-blur-sm">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
            <div className={`p-3 rounded-xl ${bgColor} ring-1 ring-white/5 self-start`}>
              <StatusIcon className={`w-6 h-6 sm:w-8 sm:h-8 ${color}`} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Tracking Details</h1>
              <p className={`text-sm ${color} font-medium mt-1`}>
                {tracking.status_details || tracking.status || 'Pending'}
              </p>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8 sm:mb-12 overflow-x-auto pb-4 sm:pb-0">
            <div className="relative min-w-[600px] sm:min-w-full">
              <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 bg-gray-700/50 rounded">
                <div 
                  className="h-full bg-purple-500 rounded transition-all duration-500" 
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
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center z-10 transition-all duration-300 ${
                          isActive ? 'bg-purple-500 text-white ring-2 ring-purple-500/20' : 'bg-gray-700/50 text-gray-400'
                        }`}
                      >
                        <StageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="mt-2 text-xs sm:text-sm font-medium text-gray-400">{stage.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tracking Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12">
            <div className={`p-4 sm:p-6 rounded-xl ${bgColor} ring-1 ring-white/5`}>
              <label className="text-xs sm:text-sm text-gray-400 block mb-1">Tracking Number</label>
              <p className="font-bold text-base sm:text-lg text-white">{tracking.tracking_number}</p>
            </div>
            <div className={`p-4 sm:p-6 rounded-xl ${bgColor} ring-1 ring-white/5`}>
              <label className="text-xs sm:text-sm text-gray-400 block mb-1">Carrier</label>
              <p className="font-bold text-base sm:text-lg text-white uppercase">{tracking.carrier}</p>
            </div>
            {tracking.estimated_delivery_date && (
              <div className={`p-4 sm:p-6 rounded-xl ${bgColor} ring-1 ring-white/5 sm:col-span-2`}>
                <label className="text-xs sm:text-sm text-gray-400 block mb-1">Estimated Delivery</label>
                <p className="font-bold text-base sm:text-lg text-white">
                  {format(new Date(tracking.estimated_delivery_date), 'PPP')}
                </p>
              </div>
            )}
          </div>

          {/* Tracking History */}
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">Tracking History</h2>
            {tracking.tracking_events && tracking.tracking_events.length > 0 ? (
              <div className="space-y-6">
                {tracking.tracking_events.map((event, index) => (
                  <div
                    key={index}
                    className={`relative pl-6 pb-6 ${
                      index !== tracking.tracking_events!.length - 1 ? 'border-l border-gray-700' : ''
                    }`}
                  >
                    <div
                      className={`absolute -left-2 w-4 h-4 rounded-full ${
                        index === 0 ? bgColor : 'bg-gray-700'
                      } flex items-center justify-center`}
                    >
                      <div className={`w-2 h-2 rounded-full ${index === 0 ? color : 'bg-gray-500'}`} />
                    </div>
                    <div>
                      <p className="text-sm sm:text-base text-white">{event.details}</p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                        <time className="text-xs sm:text-sm text-gray-400">
                          {format(new Date(event.timestamp), 'PPP p')}
                        </time>
                        {event.location && (
                          <p className="text-xs sm:text-sm text-gray-400">
                            {event.location}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-800/50 rounded-lg ring-1 ring-white/5">
                <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No tracking events available yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Last Update Time */}
        {tracking.last_update && (
          <p className="text-center text-xs sm:text-sm text-gray-500">
            Last updated: {format(new Date(tracking.last_update), 'PPP p')}
          </p>
        )}
      </div>
    </div>
  );
} 