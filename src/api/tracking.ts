import { supabase } from '../lib/supabase';

const SEVENTEEN_TRACK_API_URL = 'https://api.17track.net/track/v2.2';

interface TrackingEvent {
  a: string; // timestamp
  z: string; // status
  l: string; // location
  c: string; // description
}

interface Track17Response {
  code: number;
  message?: string;
  data?: {
    accepted?: Array<{
      track?: {
        e: string;
        z0?: {
          c?: string;
          l?: string;
        };
        z1?: {
          a?: string;
        };
        z2?: TrackingEvent[];
      };
    }>;
  };
}

export async function getTrackingInfo(trackingNumber: string) {
  try {
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

    if (orderError) throw orderError;
    if (!order) throw new Error('Order not found');

    // Then, fetch tracking info from 17TRACK
    const response = await fetch(`${SEVENTEEN_TRACK_API_URL}/gettrackinfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': process.env.SEVENTEEN_TRACK_API_KEY || ''
      },
      body: JSON.stringify([{
        number: trackingNumber,
        auto_detection: true
      }])
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tracking information: ${response.status}`);
    }

    const result = await response.json() as Track17Response;
    
    if (result.code !== 0 || !result.data?.accepted?.[0]?.track) {
      throw new Error(result.message || 'No tracking information available');
    }

    const trackData = result.data.accepted[0].track;

    // Transform 17track data to our format
    return {
      tracking_number: trackingNumber,
      status: trackData.e || 'pending',
      status_details: trackData.z0?.c,
      location: trackData.z0?.l,
      estimated_delivery: trackData.z1?.a,
      timeline: trackData.z2?.map((event: TrackingEvent) => ({
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
    };
  } catch (error) {
    console.error('Error fetching tracking info:', error);
    throw error;
  }
} 