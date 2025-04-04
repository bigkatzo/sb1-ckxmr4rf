import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const trackshipApiKey = process.env.TRACKSHIP_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TrackingEvent {
  object: string;
  message: string;
  description: string;
  status: string;
  status_detail: string;
  datetime: string;
  source: string;
  tracking_location: {
    object: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
}

interface TrackshipWebhookPayload {
  user_key: string;
  order_id: string;
  tracking_number: string;
  tracking_provider: string;
  tracking_event_status: string;
  tracking_est_delivery_date: string | null;
  tracking_destination_events: any;
  origin_country: string | null;
  destination_country: string | null;
  delivery_number: string | null;
  delivery_provider: string | null;
  shipping_service: string;
  last_event_time: string;
  events: TrackingEvent[];
  destination_events: any;
}

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Verify TrackShip API key
  const providedApiKey = event.headers['trackship-api-key'];
  if (providedApiKey !== trackshipApiKey) {
    console.error('Invalid TrackShip API key');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid API key' })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}') as TrackshipWebhookPayload;
    const { tracking_number, tracking_event_status, tracking_est_delivery_date, events } = payload;

    if (!tracking_number) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Tracking number is required' })
      };
    }

    // Get the latest event details
    const latestEvent = events[events.length - 1];
    const statusDetails = latestEvent ? latestEvent.message : '';

    // Get tracking record from our database
    const { data: tracking, error: trackingError } = await supabase
      .from('order_tracking')
      .select('id')
      .eq('tracking_number', tracking_number)
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
        status: tracking_event_status,
        status_details: statusDetails,
        estimated_delivery_date: tracking_est_delivery_date,
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

    // Store tracking events
    if (events && events.length > 0) {
      const { error: eventsError } = await supabase
        .from('tracking_events')
        .upsert(
          events.map(event => ({
            tracking_id: tracking.id,
            status: event.status,
            details: event.message,
            location: event.tracking_location ? 
              `${event.tracking_location.city}${event.tracking_location.state ? `, ${event.tracking_location.state}` : ''}` : 
              null,
            timestamp: event.datetime
          })),
          { onConflict: 'tracking_id,timestamp' }
        );

      if (eventsError) {
        console.error('Error storing tracking events:', eventsError);
        // Don't fail the webhook for events storage errors
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Tracking update processed successfully',
        tracking_number,
        status: tracking_event_status
      })
    };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 