import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Database connectivity
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Minimal webhook handler with database updates
export const handler: Handler = async (event) => {
  try {
    // Log request info
    console.log('Webhook received:', {
      method: event.httpMethod,
      path: event.path
    });

    // Parse the webhook body
    let payload: any = null;
    try {
      if (event.body) {
        payload = JSON.parse(event.body);
        console.log('Webhook event type:', payload?.event);
      }
    } catch (error) {
      console.log('Error parsing webhook body:', error);
      // Continue to acknowledge even if parsing fails
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Webhook acknowledged, but failed to parse payload',
          timestamp: new Date().toISOString()
        })
      };
    }

    // Early exit if no payload or missing data
    if (!payload || !payload.event) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Webhook acknowledged, but no valid payload found',
          timestamp: new Date().toISOString()
        })
      };
    }

    // Try to update database if we have the necessary environment variables
    let dbUpdateSuccess = false;
    let dbUpdateMessage = 'Database update not attempted';
    
    if (supabaseUrl && supabaseServiceKey && 
       (payload.event === 'TRACKING_UPDATED' || payload.event === 'TRACKING_STOPPED')) {
      
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const trackingNumber = payload.data?.number;
        
        if (trackingNumber) {
          // First, get the tracking record ID
          const { data: tracking, error: trackingError } = await supabase
            .from('order_tracking')
            .select('id')
            .eq('tracking_number', trackingNumber)
            .single();
          
          if (trackingError) {
            console.log('Error finding tracking record:', trackingError);
          } else if (tracking) {
            
            if (payload.event === 'TRACKING_UPDATED' && payload.data?.track_info) {
              // Extract tracking status data
              const trackInfo = payload.data.track_info;
              const status = trackInfo.latest_status?.status || 'unknown';
              const statusDetails = trackInfo.latest_status?.sub_status || '';
              const estimatedDelivery = trackInfo.time_metrics?.estimated_delivery_date?.from || null;
              
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
                console.log('Error updating tracking status:', updateError);
              } else {
                dbUpdateSuccess = true;
                dbUpdateMessage = 'Tracking status updated';
                
                // Try to store tracking events if available
                if (trackInfo.tracking?.providers?.[0]?.events?.length > 0) {
                  try {
                    const provider = trackInfo.tracking.providers[0];
                    const events = provider.events.map((event: any) => ({
                      tracking_id: tracking.id,
                      status: event.stage || event.sub_status || status,
                      details: event.description || '',
                      location: event.location || '',
                      timestamp: event.time_utc || new Date().toISOString()
                    }));
                    
                    await supabase
                      .from('tracking_events')
                      .upsert(events, { 
                        onConflict: 'tracking_id,timestamp'
                      });
                      
                    dbUpdateMessage += ' with events';
                  } catch (eventError) {
                    console.log('Error storing tracking events (continuing):', eventError);
                  }
                }
              }
            } else if (payload.event === 'TRACKING_STOPPED') {
              // Update tracking status for stopped tracking
              const { error: updateError } = await supabase
                .from('order_tracking')
                .update({
                  status: 'expired',
                  status_details: 'Tracking stopped',
                  last_update: new Date().toISOString()
                })
                .eq('id', tracking.id);
                
              if (updateError) {
                console.log('Error updating tracking status for stopped tracking:', updateError);
              } else {
                dbUpdateSuccess = true;
                dbUpdateMessage = 'Tracking marked as stopped';
              }
            }
          } else {
            dbUpdateMessage = 'Tracking number not found in database';
          }
        } else {
          dbUpdateMessage = 'No tracking number in payload';
        }
      } catch (dbError) {
        console.log('Database operation error:', dbError);
        dbUpdateMessage = 'Database error occurred';
      }
    }

    // Always return success to acknowledge receipt
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook acknowledged',
        event: payload.event,
        trackingNumber: payload.data?.number,
        dbUpdate: {
          success: dbUpdateSuccess,
          message: dbUpdateMessage
        },
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    // Even if everything fails, still acknowledge
    console.log('Unexpected error in webhook handler:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook received',
        error: 'Internal error occurred but webhook was received',
        timestamp: new Date().toISOString()
      })
    };
  }
}; 