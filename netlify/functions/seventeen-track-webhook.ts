import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Database connectivity
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const seventeenTrackApiKey = process.env.SEVENTEEN_TRACK_API_KEY;

// Minimal webhook handler with database updates
export const handler: Handler = async (event) => {
  let dbUpdateSuccess = false;
  let dbUpdateMessage = 'No update attempted';

  try {
    // Parse and validate the webhook payload
    const payload = JSON.parse(event.body || '{}');

    if (!payload.event || !payload.data) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid webhook payload',
          timestamp: new Date().toISOString()
        })
      };
    }

    // Only process if we have database credentials and it's a tracking event
    if (supabaseUrl && supabaseServiceKey && 
       (payload.event === 'TRACKING_UPDATED' || payload.event === 'TRACKING_STOPPED')) {
      
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const trackingNumber = payload.data?.number;
        
        if (trackingNumber) {
          // Get all tracking records with this number
          const { data: trackingRecords, error: trackingError } = await supabase
            .from('order_tracking')
            .select('id')
            .eq('tracking_number', trackingNumber);
          
          if (trackingError) {
            console.log('Error finding tracking records:', trackingError);
            return {
              statusCode: 500,
              body: JSON.stringify({
                message: 'Database error occurred',
                error: trackingError.message
              })
            };
          }

          if (trackingRecords && trackingRecords.length > 0) {
            if (payload.event === 'TRACKING_UPDATED' && payload.data?.track_info) {
              // Extract tracking status data
              const trackInfo = payload.data.track_info;
              const status = trackInfo.latest_status?.status || 'unknown';
              const statusDetails = trackInfo.latest_status?.sub_status || '';
              const estimatedDelivery = trackInfo.time_metrics?.estimated_delivery_date?.from || null;
              
              // Get carrier details from the webhook payload
              const carrierDetails = {
                name: trackInfo.carrier_info?.name,
                carrier_code: trackInfo.carrier_info?.code,
                service_type: trackInfo.service_type?.name
              };
              
              // Update all tracking records that share this tracking number
              const { error: updateError } = await supabase
                .from('order_tracking')
                .update({
                  status,
                  status_details: statusDetails,
                  estimated_delivery_date: estimatedDelivery,
                  latest_event_time: trackInfo.latest_event?.time_utc,
                  latest_event_info: trackInfo.latest_event?.description,
                  carrier_details: carrierDetails,
                  last_update: new Date().toISOString()
                })
                .eq('tracking_number', trackingNumber);
              
              if (updateError) {
                console.log('Error updating tracking status:', updateError);
                return {
                  statusCode: 500,
                  body: JSON.stringify({
                    message: 'Failed to update tracking records',
                    error: updateError.message
                  })
                };
              }

              dbUpdateSuccess = true;
              dbUpdateMessage = 'Tracking status updated for all associated orders';
              
              // Store tracking events if available
              if (trackInfo.tracking?.providers?.[0]?.events?.length > 0) {
                try {
                  const provider = trackInfo.tracking.providers[0];
                  // Create events for each tracking record
                  for (const trackingRecord of trackingRecords) {
                    const events = provider.events.map((event: any) => ({
                      tracking_id: trackingRecord.id,
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
                  }
                      
                  dbUpdateMessage += ' with events';
                } catch (eventError) {
                  console.log('Error storing tracking events (continuing):', eventError);
                }
              }
            } else if (payload.event === 'TRACKING_STOPPED') {
              // Update all tracking records for stopped tracking
              const { error: updateError } = await supabase
                .from('order_tracking')
                .update({
                  status: 'expired',
                  status_details: 'Tracking stopped',
                  last_update: new Date().toISOString()
                })
                .eq('tracking_number', trackingNumber);
                
              if (updateError) {
                console.log('Error updating tracking status for stopped tracking:', updateError);
                return {
                  statusCode: 500,
                  body: JSON.stringify({
                    message: 'Failed to update tracking records',
                    error: updateError.message
                  })
                };
              }

              dbUpdateSuccess = true;
              dbUpdateMessage = 'Tracking marked as stopped for all associated orders';
            }
          } else {
            dbUpdateMessage = 'No tracking records found for this number';
          }
        } else {
          dbUpdateMessage = 'No tracking number in payload';
        }
      } catch (dbError) {
        console.log('Database operation error:', dbError);
        return {
          statusCode: 500,
          body: JSON.stringify({
            message: 'Database error occurred',
            error: dbError.message
          })
        };
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