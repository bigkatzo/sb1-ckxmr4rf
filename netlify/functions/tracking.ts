import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const trackshipApiKey = process.env.TRACKSHIP_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TRACKSHIP_API_URL = 'https://api.trackship.com/v1';

export const handler: Handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const trackingNumber = event.path.split('/').pop();

    if (!trackingNumber) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Tracking number is required' })
      };
    }

    // First, get the order details from our database
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        product_name,
        shipping_address,
        tracking_number,
        carrier
      `)
      .eq('tracking_number', trackingNumber)
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

    // Then, fetch tracking info from Trackship
    const response = await fetch(`${TRACKSHIP_API_URL}/shipments/${trackingNumber}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${trackshipApiKey}`,
        'Trackship-Api-Key': trackshipApiKey
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch tracking information from Trackship');
    }

    const trackshipData = await response.json();

    // Combine order data with tracking data
    const trackingInfo = {
      tracking_number: trackingNumber,
      status: trackshipData.status,
      status_details: trackshipData.status_details,
      location: trackshipData.current_location,
      estimated_delivery: trackshipData.estimated_delivery_date,
      timeline: trackshipData.tracking_events.map((event: any) => ({
        date: event.datetime,
        status: event.status,
        location: event.location,
        description: event.message
      })),
      order_details: {
        order_number: order.order_number,
        product_name: order.product_name,
        shipping_address: order.shipping_address
      }
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: JSON.stringify(trackingInfo)
    };
  } catch (error) {
    console.error('Error processing tracking request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 