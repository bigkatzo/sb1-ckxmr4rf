import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const trackshipApiKey = process.env.TRACKSHIP_API_KEY!;

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
    const { orderId, trackingNumber, carrier } = JSON.parse(event.body || '{}');

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
    const response = await fetch(`${TRACKSHIP_API_URL}/shipments/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${trackshipApiKey}`,
        'Trackship-Api-Key': trackshipApiKey
      },
      body: JSON.stringify({
        tracking_number: trackingNumber,
        carrier: carrier || 'usps', // Default to USPS if no carrier specified
        order_id: order.order_number,
        shipping_address: order.shipping_address,
        metadata: {
          order_id: order.id,
          store_order_number: order.order_number
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('TrackShip registration failed:', errorData);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Failed to register tracking with TrackShip' })
      };
    }

    const trackshipData = await response.json();

    // Update order with tracking status from TrackShip
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        tracking_status: trackshipData.status,
        tracking_details: trackshipData.status_details,
        status: trackshipData.status.toLowerCase() === 'delivered' ? 'delivered' : 'shipped'
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order with tracking status:', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update order with tracking status' })
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
    console.error('Error processing tracking registration:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 