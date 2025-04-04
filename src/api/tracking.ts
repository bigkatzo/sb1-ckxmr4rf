import { supabase } from '../lib/supabaseClient';

const TRACKSHIP_API_URL = 'https://api.trackship.com/v1';

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

    // Then, fetch tracking info from Trackship
    const response = await fetch(`${TRACKSHIP_API_URL}/shipments/${trackingNumber}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TRACKSHIP_API_KEY}`,
        'Trackship-Api-Key': `${process.env.TRACKSHIP_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch tracking information from Trackship');
    }

    const trackshipData = await response.json();

    // Combine order data with tracking data
    return {
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
  } catch (error) {
    console.error('Error fetching tracking info:', error);
    throw error;
  }
} 