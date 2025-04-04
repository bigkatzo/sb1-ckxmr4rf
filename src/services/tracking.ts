import { supabase } from '../lib/supabase';
import { OrderTracking } from '../types/orders';

// Remove unused constant since it's not being used
// const TRACKSHIP_API_URL = process.env.NEXT_PUBLIC_TRACKSHIP_API_URL;

export async function addTracking(orderId: string, trackingNumber: string, carrier: string = 'usps'): Promise<OrderTracking> {
  const { data, error } = await supabase
    .from('order_tracking')
    .insert({
      order_id: orderId,
      tracking_number: trackingNumber,
      carrier
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTrackingInfo(trackingNumber: string): Promise<OrderTracking | null> {
  const { data, error } = await supabase
    .from('order_tracking')
    .select(`
      *,
      tracking_events (*)
    `)
    .eq('tracking_number', trackingNumber)
    .single();

  if (error) throw error;
  return data;
}

export async function updateTrackingStatus(
  trackingNumber: string,
  status: string,
  statusDetails?: string,
  estimatedDeliveryDate?: string
): Promise<void> {
  const { error } = await supabase
    .from('order_tracking')
    .update({
      status,
      status_details: statusDetails,
      estimated_delivery_date: estimatedDeliveryDate,
      last_update: new Date().toISOString()
    })
    .eq('tracking_number', trackingNumber);

  if (error) throw error;
}

export async function addTrackingEvent(
  trackingId: string,
  event: {
    status: string;
    details: string;
    location: string;
    timestamp: string;
  }
) {
  try {
    const { error } = await supabase
      .from('tracking_events')
      .insert({
        tracking_id: trackingId,
        status: event.status,
        details: event.details,
        location: event.location,
        timestamp: event.timestamp
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error adding tracking event:', error);
    throw error;
  }
} 