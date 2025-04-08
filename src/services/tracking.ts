import { supabase } from '../lib/supabase';
import { OrderTracking } from '../types/orders';

// 17TRACK API carrier codes
export const CARRIER_CODES: Record<string, number> = {
  usps: 21051,
  fedex: 100003,
  ups: 100001,
  dhl: 7041,
  'dhl-express': 7042,
  // Add more carriers as needed
};

export function getCarrierCode(carrier: string): number {
  return CARRIER_CODES[carrier.toLowerCase()] || 0;
}

// Map 17TRACK status to our system status
export function mapTrackingStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'InfoReceived': 'pending',
    'InTransit': 'confirmed',
    'AvailableForPickup': 'in_transit',
    'OutForDelivery': 'in_transit',
    'DeliveryFailure': 'exception',
    'Delivered': 'delivered',
    'Exception': 'exception',
    'Expired': 'exception',
    'NotFound': 'pending',
  };
  
  return statusMap[status] || 'pending';
}

// Check if status requires customer notification
// Note: Currently not used for email notifications as email is not supported
export function shouldNotifyStatus(status: string): boolean {
  const notifyStatuses = [
    'Delivered',
    'OutForDelivery',
    'DeliveryFailure',
    'Exception'
  ];
  
  return notifyStatuses.includes(status);
}

// Get a user-friendly status message
// Note: Currently not used for email notifications as email is not supported
export function getStatusMessage(status: string, subStatus: string): string {
  switch (status) {
    case 'Delivered':
      return 'Your package has been delivered!';
    case 'OutForDelivery':
      return 'Your package is out for delivery today!';
    case 'DeliveryFailure':
      return `Delivery attempt failed: ${subStatus || 'Please check tracking for details'}`;
    case 'Exception':
      if (subStatus === 'Exception_Returning') {
        return 'Your package is being returned to sender';
      }
      return `Delivery exception: ${subStatus || 'Please check tracking for details'}`;
    case 'InTransit':
      return 'Your package is in transit';
    default:
      return `Tracking status updated: ${status}`;
  }
}

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

export async function verify17TrackSignature(payload: string, signature: string, apiKey: string): Promise<boolean> {
  try {
    const crypto = require('crypto');
    const src = payload + '/' + apiKey;
    const calculatedSignature = crypto
      .createHash('sha256')
      .update(src)
      .digest('hex');
    
    return calculatedSignature === signature;
  } catch (error) {
    console.error('Error verifying 17TRACK signature:', error);
    return false;
  }
} 