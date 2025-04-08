import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { verify17TrackSignature } from '../../src/services/tracking';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const seventeenTrackApiKey = process.env.SEVENTEEN_TRACK_API_KEY;

// Only create supabase client if environment variables are available
const getSupabaseClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables for database connection');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
};

export const handler: Handler = async (event) => {
  // Log incoming request for debugging (without sensitive data)
  console.log('Webhook received:', {
    method: event.httpMethod,
    path: event.path,
    headers: {
      ...event.headers,
      // Remove potentially sensitive headers from logs
      '17token': event.headers['17token'] ? '[REDACTED]' : undefined,
      'sign': event.headers['sign'] ? '[REDACTED]' : undefined
    }
  });

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    let payload;
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch (error) {
      console.error('Error parsing webhook body:', error);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    // Log the event type for debugging
    console.log('Webhook event type:', payload.event);

    // Skip signature verification in development (empty conditionals for clarity)
    if (process.env.NODE_ENV === 'production') {
      // Verify the signature if provided and if we have the API key
      const signature = event.headers['sign'];
      if (signature && seventeenTrackApiKey) {
        try {
          const isValid = await verify17TrackSignature(event.body || '', signature, seventeenTrackApiKey);
          if (!isValid) {
            console.error('Invalid 17TRACK signature');
            return {
              statusCode: 401,
              body: JSON.stringify({ error: 'Invalid signature' })
            };
          }
        } catch (error) {
          console.error('Error verifying signature:', error);
          // Continue processing even if signature verification fails
          // This helps during testing and initial setup
        }
      }
    }
    
    // Handle different webhook events
    if (payload.event === 'TRACKING_UPDATED' && payload.data?.track_info) {
      const { number, track_info } = payload.data;
      
      if (!number) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing tracking number' })
        };
      }

      try {
        const supabase = getSupabaseClient();
        
        // Get tracking record from our database
        const { data: tracking, error: trackingError } = await supabase
          .from('order_tracking')
          .select('id')
          .eq('tracking_number', number)
          .single();

        if (trackingError) {
          console.error('Error fetching tracking record:', trackingError);
          throw trackingError;
        }

        if (!tracking) {
          return {
            statusCode: 404,
            body: JSON.stringify({ 
              error: 'Tracking record not found',
              tracking_number: number
            })
          };
        }

        // Extract tracking data
        const status = track_info.latest_status?.status || 'unknown';
        const statusDetails = track_info.latest_status?.sub_status || '';
        const estimatedDelivery = track_info.time_metrics?.estimated_delivery_date?.from || null;

        // Update tracking status
        const { error: updateError } = await supabase
          .from('order_tracking')
          .update({
            status,
            status_details: statusDetails,
            estimated_delivery_date: estimatedDelivery,
            last_update: new Date().toISOString()
          })
          .eq('id', tracking.id);

        if (updateError) {
          console.error('Error updating tracking status:', updateError);
          throw updateError;
        }

        // Store tracking events if available
        if (track_info.tracking?.providers?.[0]?.events?.length > 0) {
          const provider = track_info.tracking.providers[0];
          const events = provider.events.map(event => ({
            tracking_id: tracking.id,
            status: event.stage || event.sub_status || status,
            details: event.description || '',
            location: event.location || '',
            timestamp: event.time_utc || new Date().toISOString()
          }));

          // Upsert events
          const { error: eventsError } = await supabase
            .from('tracking_events')
            .upsert(events, { 
              onConflict: 'tracking_id,timestamp'
            });

          if (eventsError) {
            console.error('Error storing tracking events:', eventsError);
            // Don't fail the webhook for events storage errors
          }
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ 
            message: 'Tracking update processed successfully',
            tracking_number: number,
            status
          })
        };
      } catch (error) {
        console.error('Database operation error:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ 
            error: 'Database operation failed',
            message: error.message || 'Unknown error'
          })
        };
      }
    } else if (payload.event === 'TRACKING_STOPPED') {
      const { number } = payload.data || {};
      
      if (!number) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing tracking number' })
        };
      }

      try {
        const supabase = getSupabaseClient();
        
        // Update tracking record to mark it as stopped
        const { error: updateError } = await supabase
          .from('order_tracking')
          .update({
            status: 'expired',
            status_details: 'Tracking stopped',
            last_update: new Date().toISOString()
          })
          .eq('tracking_number', number);
          
        if (updateError) {
          console.error('Error updating tracking status:', updateError);
          throw updateError;
        }

        return {
          statusCode: 200,
          body: JSON.stringify({ 
            message: 'Tracking stopped processed successfully',
            tracking_number: number
          })
        };
      } catch (error) {
        console.error('Database operation error:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ 
            error: 'Database operation failed',
            message: error.message || 'Unknown error'
          })
        };
      }
    }

    // For unhandled or unknown event types, still return success
    // This ensures 17TRACK doesn't retry sending the webhook unnecessarily
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook received but not processed',
        event: payload.event || 'unknown'
      })
    };
  } catch (error) {
    console.error('Unexpected error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message || 'Unknown error'
      })
    };
  }
}; 