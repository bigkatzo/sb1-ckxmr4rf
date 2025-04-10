// CommonJS version of the get-tracking-status function
const { getCarrierCode } = require('./tracking-utils');
const { withErrorHandling, errors } = require('./utils/errorMiddleware');

// Ensure environment variables are properly handled
const seventeenTrackApiKey = process.env.SEVENTEEN_TRACK_API_KEY;
const SEVENTEEN_TRACK_API_URL = 'https://api.17track.net/track/v2.2';

/**
 * Serverless function to get tracking status from 17TRACK
 */
const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return errors.methodNotAllowed('Only POST requests are allowed');
  }

  const { tracking_number, carrier } = JSON.parse(event.body || '{}');
  
  if (!tracking_number) {
    return errors.badRequest('Tracking number is required');
  }

  if (!seventeenTrackApiKey) {
    return errors.serverError('17TRACK API configuration is missing');
  }

  // Get carrier code if provided
  const carrierCode = carrier ? getCarrierCode(carrier) : undefined;
  
  // Use realtime tracking to get the most up-to-date information
  const response = await fetch(`${SEVENTEEN_TRACK_API_URL}/getRealTimeTrackInfo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      '17token': seventeenTrackApiKey,
    },
    body: JSON.stringify([
      {
        number: tracking_number,
        carrier: carrierCode,
        auto_detection: true,
        cacheLevel: 1 // 1 = real-time fetch from carrier
      }
    ]),
  });

  const data = await response.json();

  // Transform the response to a more client-friendly format if needed
  if (data.code === 0 && data.data?.accepted?.length > 0) {
    const trackingInfo = data.data.accepted[0].track_info;
    
    // Format into a more user-friendly structure
    const formattedData = {
      status: 'success',
      data: {
        tracking_number: tracking_number,
        carrier: carrierCode,
        tracking_event_status: trackingInfo.latest_status?.status || 'NotFound',
        tracking_est_delivery_date: trackingInfo.time_metrics?.estimated_delivery_date?.from,
        shipping_service: trackingInfo.misc_info?.service_type,
        last_event_time: trackingInfo.latest_event?.time_utc,
        events: trackingInfo.tracking?.providers?.[0]?.events?.map(event => ({
          message: event.description,
          status: event.stage || event.sub_status,
          status_detail: event.sub_status,
          datetime: event.time_iso,
          tracking_location: {
            country: event.address?.country,
            city: event.address?.city,
            state: event.address?.state,
            zip: event.address?.postal_code,
            location: event.location
          }
        })) || []
      }
    };

    return {
      statusCode: 200,
      body: JSON.stringify(formattedData),
    };
  }

  // Handle errors or rejected tracking numbers
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'error',
      message: data.data?.rejected?.[0]?.error?.message || 'Failed to fetch tracking status',
      data: {
        tracking_number: tracking_number,
        events: []
      }
    }),
  };
};

// Export the wrapped handler with error handling
exports.handler = withErrorHandling(handler); 