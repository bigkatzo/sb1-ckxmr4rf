import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const trackshipApiKey = process.env.TRACKSHIP_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Verify Trackship webhook signature
  const signature = event.headers['trackship-signature'];
  if (signature !== trackshipApiKey) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid signature' })
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { tracking_number, status, status_details } = payload;

    if (!tracking_number) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Tracking number is required' })
      };
    }

    // Map Trackship status to our order status
    let orderStatus;
    switch (status.toLowerCase()) {
      case 'delivered':
        orderStatus = 'delivered';
        break;
      case 'in_transit':
      case 'out_for_delivery':
        orderStatus = 'shipped';
        break;
      default:
        // Don't update order status for other tracking statuses
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Status not mapped, no update needed' })
        };
    }

    // Update order status in database
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: orderStatus,
        tracking_status: status,
        tracking_details: status_details,
        updated_at: new Date().toISOString()
      })
      .eq('tracking_number', tracking_number);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update order status' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Order status updated successfully',
        tracking_number,
        status: orderStatus
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