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

    // Map TrackShip status to our order status
    let orderStatus;
    switch (tracking_event_status.toLowerCase()) {
      case 'delivered':
        orderStatus = 'delivered';
        break;
      case 'in_transit':
      case 'out_for_delivery':
      case 'pre_transit':
        orderStatus = 'shipped';
        break;
      case 'exception':
      case 'failure':
        // Don't update order status for exceptions, but store the tracking status
        orderStatus = undefined;
        break;
      default:
        // Don't update order status for unknown tracking statuses
        orderStatus = undefined;
    }

    // Update order in database
    const updateData: Record<string, any> = {
      tracking_status: tracking_event_status,
      tracking_details: statusDetails,
      updated_at: new Date().toISOString()
    };

    // Only update order status if we have a valid mapping
    if (orderStatus) {
      updateData.status = orderStatus;
    }

    // Add estimated delivery date if available
    if (tracking_est_delivery_date) {
      updateData.estimated_delivery_date = tracking_est_delivery_date;
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('tracking_number', tracking_number);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update order status' })
      };
    }

    // Store tracking events in tracking_history table for detailed timeline
    if (events && events.length > 0) {
      const { error: historyError } = await supabase
        .from('tracking_history')
        .upsert(
          events.map(event => ({
            tracking_number,
            status: event.status,
            status_detail: event.status_detail,
            message: event.message,
            location: event.tracking_location ? 
              `${event.tracking_location.city}${event.tracking_location.state ? `, ${event.tracking_location.state}` : ''}` : 
              null,
            timestamp: event.datetime,
            created_at: new Date().toISOString()
          })),
          { onConflict: 'tracking_number,timestamp' }
        );

      if (historyError) {
        console.error('Error storing tracking history:', historyError);
        // Don't fail the webhook for history storage errors
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