import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const trackshipApiKey = process.env.TRACKSHIP_API_KEY!;
const appName = process.env.TRACKSHIP_APP_NAME!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TRACKSHIP_API_URL = 'https://api.trackship.com/v1';

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { orderId, trackingNumber, carrier = 'usps' } = JSON.parse(event.body || '{}');

    if (!orderId || !trackingNumber) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Order ID and tracking number are required' })
      };
    }

    // Get order details from database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Error fetching order details' })
      };
    }

    if (!order) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Order not found' })
      };
    }

    // Register tracking with TrackShip
    const response = await fetch(`${TRACKSHIP_API_URL}/shipment/register/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'trackship-api-key': trackshipApiKey,
        'app-name': appName
      },
      body: JSON.stringify({
        tracking_number: trackingNumber,
        tracking_provider: carrier,
        order_id: order.order_number,
        shipping_address: order.shipping_address,
        metadata: {
          order_id: order.id,
          store_order_number: order.order_number
        }
      })
    });

    const trackshipData = await response.json();

    if (trackshipData.status === 'error') {
      console.error('TrackShip registration failed:', trackshipData);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: trackshipData.message || 'Failed to register tracking with TrackShip' })
      };
    }

    // Create tracking record in our database
    const { error: trackingError } = await supabase
      .from('order_tracking')
      .insert({
        order_id: orderId,
        tracking_number: trackingNumber,
        carrier,
        status: trackshipData.data?.tracking_event_status || 'pending',
        status_details: trackshipData.data?.status_details || 'Tracking registered',
        last_update: new Date().toISOString()
      });

    if (trackingError) {
      console.error('Error creating tracking record:', trackingError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create tracking record' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Tracking registered successfully',
        tracking: trackshipData
      })
    };
  } catch (error) {
    console.error('Error registering tracking:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to register tracking' })
    };
  }
}; 