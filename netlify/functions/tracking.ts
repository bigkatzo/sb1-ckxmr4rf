import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const seventeenTrackApiKey = process.env.SEVENTEEN_TRACK_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SEVENTEEN_TRACK_API_URL = 'https://api.17track.net/track/v2.2';

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

    // Fetch tracking info from 17TRACK
    const response = await fetch(`${SEVENTEEN_TRACK_API_URL}/gettrackinfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': seventeenTrackApiKey
      },
      body: JSON.stringify([{
        number: trackingNumber,
        auto_detection: true
      }])
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tracking information: ${response.status}`);
    }

    const result = await response.json();

    if (result.code !== 0 || !result.data?.accepted?.[0]?.track) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          tracking_number: trackingNumber,
          status: 'NotFound',
          status_details: result.message || 'No tracking information available',
          order_details: {
            order_number: order.order_number,
            product_name: order.product_name,
            shipping_address: order.shipping_address
          }
        })
      };
    }

    const trackData = result.data.accepted[0].track;

    // Transform 17track data to our format
    return {
      statusCode: 200,
      body: JSON.stringify({
        tracking_number: trackingNumber,
        status: trackData.e || 'NotFound',
        status_details: trackData.z0?.c,
        location: trackData.z0?.l,
        estimated_delivery: trackData.z1?.a,
        timeline: trackData.z2?.map(event => ({
          date: event.a,
          status: event.z,
          location: event.l,
          description: event.c
        })) || [],
        order_details: {
          order_number: order.order_number,
          product_name: order.product_name,
          shipping_address: order.shipping_address
        }
      })
    };
  } catch (error) {
    console.error('Error fetching tracking:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to fetch tracking information'
      })
    };
  }
}; 