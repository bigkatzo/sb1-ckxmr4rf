import { supabase } from '../lib/supabase';
import { OrderTracking } from '../types/orders';

// API endpoints and keys
const SEVENTEEN_TRACK_API_URL = 'https://api.17track.net/track/v2.2';
const SEVENTEEN_TRACK_API_KEY = import.meta.env.VITE_SEVENTEEN_TRACK_API_KEY;

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

/**
 * Deletes a tracking number from both our database and 17TRACK
 * @param trackingNumber The tracking number to delete
 * @param carrier Optional carrier code
 * @returns Object containing success status and any error messages
 */
export async function deleteTracking(trackingNumber: string, carrier?: number): Promise<{
  success: boolean;
  message?: string;
  dbSuccess?: boolean;
  apiSuccess?: boolean;
}> {
  let dbSuccess = false;
  let apiSuccess = false;
  let errorMessage = '';

  try {
    // First, delete from our database
    const { error } = await supabase
      .from('order_tracking')
      .delete()
      .eq('tracking_number', trackingNumber);

    if (error) {
      errorMessage = `Database error: ${error.message}`;
      console.error('Error deleting tracking from database:', error);
    } else {
      dbSuccess = true;
    }

    // Then remove from 17TRACK regardless of database success
    // This ensures we don't keep consuming quota for tracking we don't need
    try {
      const apiResponse = await fetch(`${SEVENTEEN_TRACK_API_URL}/deletetrack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          '17token': SEVENTEEN_TRACK_API_KEY
        },
        body: JSON.stringify([{
          number: trackingNumber,
          carrier // Optional carrier code
        }])
      });

      const result = await apiResponse.json();
      
      if (result.code === 0 && result.data?.accepted?.length > 0) {
        apiSuccess = true;
      } else {
        const apiError = result.data?.rejected?.[0]?.error?.message || 'Unknown API error';
        errorMessage += errorMessage ? ` | API error: ${apiError}` : `API error: ${apiError}`;
        console.error('Error deleting tracking from 17TRACK:', result);
      }
    } catch (apiError: any) {
      errorMessage += errorMessage ? ` | API error: ${apiError.message}` : `API error: ${apiError.message}`;
      console.error('Exception deleting tracking from 17TRACK:', apiError);
    }

    // Return comprehensive result
    return {
      success: dbSuccess && apiSuccess,
      message: dbSuccess && apiSuccess ? 'Tracking deleted successfully' : errorMessage,
      dbSuccess,
      apiSuccess
    };
  } catch (error: any) {
    console.error('Unexpected error deleting tracking:', error);
    return {
      success: false,
      message: `Unexpected error: ${error.message}`,
      dbSuccess,
      apiSuccess
    };
  }
} 