import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getCarrierCode } from '../../src/services/tracking';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const seventeenTrackApiKey = process.env.SEVENTEEN_TRACK_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SEVENTEEN_TRACK_API_URL = 'https://api.17track.net/track/v2.2';

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

    // Get carrier code for 17TRACK
    const carrierCode = carrier ? getCarrierCode(carrier) : undefined;
    
    // Register tracking with 17TRACK
    const response = await fetch(`${SEVENTEEN_TRACK_API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': seventeenTrackApiKey
      },
      body: JSON.stringify([{
        number: trackingNumber,
        carrier: carrierCode,
        auto_detection: true,
        order_no: order.order_number,
        order_time: order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : undefined,
        remark: `Order ${order.order_number}`
      }])
    });

    const trackingResponse = await response.json();

    if (trackingResponse.code !== 0) {
      console.error('17TRACK registration failed:', trackingResponse);
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Failed to register tracking with 17TRACK',
          details: trackingResponse
        })
      };
    }

    // Create tracking record in our database
    const { data: trackingRecord, error: trackingError } = await supabase
      .from('order_tracking')
      .insert({
        order_id: orderId,
        tracking_number: trackingNumber,
        carrier,
        status: 'pending',
        status_details: 'Tracking registered',
        last_update: new Date().toISOString()
      })
      .select()
      .single();

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
        tracking: trackingRecord,
        tracking_service_response: trackingResponse
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