import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { mapTrackingStatus } from '../../src/services/tracking';

// Minimal webhook handler with database integration
export const handler: Handler = async (event) => {
  // Always log basic request info
  console.log('Webhook received:', {
    method: event.httpMethod,
    path: event.path
  });

  try {
    // Parse the webhook body
    let payload: any = null;
    try {
      if (event.body) {
        payload = JSON.parse(event.body);
        console.log('Webhook payload:', {
          event: payload?.event,
          trackingNumber: payload?.data?.number,
          status: payload?.data?.track_info?.latest_status?.status
        });
      } else {
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Webhook acknowledged, but no body was provided',
            timestamp: new Date().toISOString()
          })
        };
      }
    } catch (error) {
      console.log('Error parsing webhook body:', error);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Webhook received, but payload could not be parsed',
          error: (error as Error).message
        })
      };
    }

    // If this is just a test ping from 17TRACK, acknowledge it
    if (!payload.event || !payload.data) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Test webhook acknowledged',
          timestamp: new Date().toISOString()
        })
      };
    }

    // Process different event types
    if (payload.event === 'TRACKING_UPDATED' && payload.data?.track_info) {
      // Try to update tracking in database - but don't fail the webhook if we can't
      const trackingSuccess = await tryUpdateTracking(payload);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Webhook processed successfully',
          trackingNumber: payload.data.number,
          status: payload.data.track_info?.latest_status?.status,
          dbUpdateSuccess: trackingSuccess
        })
      };
    } else if (payload.event === 'TRACKING_STOPPED') {
      // Try to mark tracking as stopped
      const trackingSuccess = await tryStopTracking(payload);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Tracking stopped webhook processed',
          trackingNumber: payload.data.number,
          dbUpdateSuccess: trackingSuccess
        })
      };
    }

    // For any other event type, acknowledge receipt
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook acknowledged but not processed',
        event: payload.event,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    // Catch all other errors but still acknowledge the webhook
    console.error('Unexpected error in webhook handler:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook received despite error',
        error: (error as Error).message || 'Unknown error',
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Helper function to update tracking in the database
async function tryUpdateTracking(payload: any): Promise<boolean> {
  try {
    const { number, track_info } = payload.data;
    
    if (!number || !track_info) {
      console.error('Missing tracking number or tracking info in payload');
      return false;
    }

    // Connect to Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return false;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get tracking record with order details to potentially send notifications
    const { data: tracking, error: trackingError } = await supabase
      .from('order_tracking')
      .select(`
        id,
        orders (
          id,
          order_number,
          product_name,
          shipping_address,
          contact_info
        )
      `)
      .eq('tracking_number', number)
      .single();

    if (trackingError || !tracking) {
      console.error('Error fetching tracking or tracking not found:', trackingError);
      return false;
    }

    // Extract tracking data
    const originalStatus = track_info.latest_status?.status || 'NotFound';
    const subStatus = track_info.latest_status?.sub_status || '';
    const status = mapTrackingStatus(originalStatus); // Map to our system's status values
    const estimatedDelivery = track_info.time_metrics?.estimated_delivery_date?.from || null;

    // Update tracking status
    const { error: updateError } = await supabase
      .from('order_tracking')
      .update({
        status,
        status_details: subStatus,
        estimated_delivery_date: estimatedDelivery,
        last_update: new Date().toISOString()
      })
      .eq('id', tracking.id);

    if (updateError) {
      console.error('Error updating tracking status:', updateError);
      return false;
    }

    // Only try to add events if they exist
    if (track_info.tracking?.providers?.[0]?.events?.length > 0) {
      try {
        const provider = track_info.tracking.providers[0];
        const events = provider.events.map((event: any) => ({
          tracking_id: tracking.id,
          status: event.stage || event.sub_status || originalStatus,
          details: event.description || '',
          location: event.location || '',
          timestamp: event.time_utc || new Date().toISOString()
        }));

        // Upsert events
        await supabase
          .from('tracking_events')
          .upsert(events, { 
            onConflict: 'tracking_id,timestamp'
          });
          
      } catch (eventError) {
        // Log but don't fail the whole operation if events insertion fails
        console.error('Error storing tracking events:', eventError);
      }
    }

    return true;
  } catch (error) {
    console.error('Error in tryUpdateTracking:', error);
    return false;
  }
}

// Helper function to mark tracking as stopped
async function tryStopTracking(payload: any): Promise<boolean> {
  try {
    const { number } = payload.data;
    
    if (!number) {
      console.error('Missing tracking number in stopped payload');
      return false;
    }

    // Connect to Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return false;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Update tracking record
    const { error: updateError } = await supabase
      .from('order_tracking')
      .update({
        status: 'expired',
        status_details: 'Tracking stopped',
        last_update: new Date().toISOString()
      })
      .eq('tracking_number', number);

    if (updateError) {
      console.error('Error updating tracking status for stopped tracking:', updateError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in tryStopTracking:', error);
    return false;
  }
} 