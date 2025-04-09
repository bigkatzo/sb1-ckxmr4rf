import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Package, Clock, MapPin, AlertCircle, CheckCircle, Truck, Box, Home } from 'lucide-react';
import { getTrackingInfo } from '../services/tracking';
import { OrderTracking } from '../types/orders';
import { format } from 'date-fns';
import { SupportMessage } from '../components/ui/SupportMessage';

// Define tracking stages for the progress indicator
const TRACKING_STAGES = [
  { id: 'pending', label: 'Order Confirmed', icon: Package },
  { id: 'confirmed', label: 'Processing', icon: Box },
  { id: 'in_transit', label: 'In Transit', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: Home },
] as const;

// Helper function to get status color and icon
const getStatusInfo = (status: string) => {
  // Map 17track status codes to our display format
  const statusMap: Record<string, { color: string; bgColor: string; icon: typeof Package; label: string }> = {
    'NotFound': { 
      color: 'text-gray-400', 
      bgColor: 'bg-gray-400/10', 
      icon: Package,
      label: 'Pending'
    },
    'InfoReceived': { 
      color: 'text-yellow-400', 
      bgColor: 'bg-yellow-400/10', 
      icon: Clock,
      label: 'Information Received'
    },
    'InTransit': { 
      color: 'text-purple-400', 
      bgColor: 'bg-purple-400/10', 
      icon: Truck,
      label: 'In Transit'
    },
    'OutForDelivery': { 
      color: 'text-blue-400', 
      bgColor: 'bg-blue-400/10', 
      icon: Truck,
      label: 'Out for Delivery'
    },
    'Delivered': { 
      color: 'text-green-400', 
      bgColor: 'bg-green-400/10', 
      icon: CheckCircle,
      label: 'Delivered'
    },
    'Exception': { 
      color: 'text-red-400', 
      bgColor: 'bg-red-400/10', 
      icon: AlertCircle,
      label: 'Exception'
    },
    'Expired': { 
      color: 'text-red-400', 
      bgColor: 'bg-red-400/10', 
      icon: AlertCircle,
      label: 'Expired'
    }
  };
  return statusMap[status] || { 
    color: 'text-gray-400', 
    bgColor: 'bg-gray-400/10', 
    icon: Package,
    label: 'Unknown Status'
  };
};

// Helper function to get stage progress
const getStageProgress = (status: string) => {
  const statusMap: Record<string, number> = {
    'NotFound': 0,
    'InfoReceived': 0,
    'InTransit': 2,
    'OutForDelivery': 2,
    'Delivered': 3,
    'Exception': 1,
    'Expired': 1
  };
  return statusMap[status] || 0;
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
        console.error('Tracking error:', err);
        setError(
          err instanceof Error 
            ? err.message 
            : 'Failed to fetch tracking information. Please try again later.'
        );
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
      <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4 sm:p-6 lg:p-8 animate-pulse">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-6 bg-gray-700 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-1/3"></div>
              </div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 text-red-400 mb-6">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Tracking Error</h1>
            <p className="text-gray-400 max-w-md mx-auto">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-6 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
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
          {tracking.timeline && tracking.timeline.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Tracking History</h2>
              <div className="space-y-4">
                {tracking.timeline.map((event, index) => (
                  <div
                    key={index}
                    className={`p-4 sm:p-6 rounded-xl ${index === 0 ? bgColor : 'bg-gray-800/50'} ring-1 ring-white/5`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${index === 0 ? bgColor : 'bg-gray-800'} ring-1 ring-white/5`}>
                        {index === 0 ? (
                          <StatusIcon className={`w-5 h-5 ${color}`} />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${index === 0 ? color : 'text-white'}`}>
                          {event.status}
                        </p>
                        {event.description && (
                          <p className="mt-1 text-sm text-gray-400">{event.description}</p>
                        )}
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>{event.location}</span>
                            </div>
                          )}
                          {event.date && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{format(new Date(event.date), 'PPp')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order Details */}
          {tracking.order_details && (
            <div className="mt-8 space-y-4">
              <h2 className="text-lg font-semibold text-white">Order Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 sm:p-6 rounded-xl bg-gray-800/50 ring-1 ring-white/5">
                  <label className="text-xs text-gray-400 block mb-1">Order Number</label>
                  <p className="font-medium text-white">{tracking.order_details.order_number}</p>
                </div>
                <div className="p-4 sm:p-6 rounded-xl bg-gray-800/50 ring-1 ring-white/5">
                  <label className="text-xs text-gray-400 block mb-1">Product</label>
                  <p className="font-medium text-white">{tracking.order_details.product_name}</p>
                </div>
                {tracking.order_details.shipping_address && (
                  <div className="p-4 sm:p-6 rounded-xl bg-gray-800/50 ring-1 ring-white/5 sm:col-span-2">
                    <label className="text-xs text-gray-400 block mb-1">Shipping Address</label>
                    <p className="font-medium text-white whitespace-pre-line">
                      {tracking.order_details.shipping_address}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Last Update Time */}
        {tracking.last_update && (
          <p className="text-center text-xs sm:text-sm text-gray-500">
            Last updated: {format(new Date(tracking.last_update), 'PPP p')}
          </p>
        )}

        {/* Support Message */}
        <div className="mt-8">
          <SupportMessage />
        </div>
      </div>
    </div>
  );
} 