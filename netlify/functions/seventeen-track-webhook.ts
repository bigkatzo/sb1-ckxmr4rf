import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { verify17TrackSignature } from '../../src/services/tracking';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const seventeenTrackApiKey = process.env.SEVENTEEN_TRACK_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Event17Track {
  time_iso: string;
  time_utc: string;
  description: string;
  location: string;
  stage: string;
  sub_status: string;
}

interface SeventeenTrackWebhookPayload {
  event: string;
  data: {
    number: string;
    carrier: number;
    param?: string;
    tag?: string;
    track_info?: {
      latest_status: {
        status: string;
        sub_status: string;
      };
      latest_event: Event17Track;
      time_metrics: {
        estimated_delivery_date: {
          from: string | null;
          to: string | null;
        };
      };
      tracking: {
        providers: Array<{
          provider: {
            key: number;
            name: string;
          };
          events: Event17Track[];
        }>;
      };
    };
  };
}

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Verify the signature if provided
    const signature = event.headers['sign'];
    if (signature) {
      const isValid = await verify17TrackSignature(event.body || '', signature, seventeenTrackApiKey);
      if (!isValid) {
        console.error('Invalid 17TRACK signature');
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Invalid signature' })
        };
      }
    }

    const payload = JSON.parse(event.body || '{}') as SeventeenTrackWebhookPayload;
    
    // Handle different webhook events
    if (payload.event === 'TRACKING_UPDATED' && payload.data.track_info) {
      const { number, track_info } = payload.data;
      const { latest_status, latest_event, time_metrics } = track_info;

      // Get tracking record from our database
      const { data: tracking, error: trackingError } = await supabase
        .from('order_tracking')
        .select('id')
        .eq('tracking_number', number)
        .single();

      if (trackingError) {
        console.error('Error fetching tracking record:', trackingError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to fetch tracking record' })
        };
      }

      if (!tracking) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Tracking record not found' })
        };
      }

      // Update tracking status
      const { error: updateError } = await supabase
        .from('order_tracking')
        .update({
          status: latest_status.status,
          status_details: latest_status.sub_status,
          estimated_delivery_date: time_metrics.estimated_delivery_date?.from,
          last_update: new Date().toISOString()
        })
        .eq('id', tracking.id);

      if (updateError) {
        console.error('Error updating tracking status:', updateError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to update tracking status' })
        };
      }

      // Store tracking events if available
      if (track_info.tracking.providers && track_info.tracking.providers.length > 0) {
        const provider = track_info.tracking.providers[0];
        if (provider.events && provider.events.length > 0) {
          // Prepare events data for upsert
          const events = provider.events.map(event => ({
            tracking_id: tracking.id,
            status: event.stage || event.sub_status || latest_status.status,
            details: event.description,
            location: event.location || '',
            timestamp: event.time_utc
          }));

          const { error: eventsError } = await supabase
            .from('tracking_events')
            .upsert(events, { onConflict: 'tracking_id,timestamp' });

          if (eventsError) {
            console.error('Error storing tracking events:', eventsError);
            // Don't fail the webhook for events storage errors
          }
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Tracking update processed successfully',
          tracking_number: number,
          status: latest_status.status
        })
      };
    } else if (payload.event === 'TRACKING_STOPPED') {
      // Handle tracking stopped event if needed
      const { number } = payload.data;
      
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
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to update tracking status' })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Tracking stopped processed successfully',
          tracking_number: number
        })
      };
    }

    // Unknown event type
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Unknown event type' })
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 