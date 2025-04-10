import { supabase } from '../lib/supabase';
import { OrderTracking } from '../types/orders';

// API proxy endpoint for frontend calls to avoid CSP issues
const API_PROXY_URL = process.env.NODE_ENV === 'production' 
  ? 'https://store.fun/.netlify/functions/tracking-api-proxy'
  : '/.netlify/functions/tracking-api-proxy';

// Local carrier list URL (to avoid CSP issues)
const CARRIER_LIST_URL = '/data/carriers.json';

// 17TRACK API carrier codes
export const CARRIER_CODES: Record<string, number> = {
  usps: 21051,
  fedex: 100003,
  ups: 100001,
  dhl: 7041,
  'dhl-express': 7042,
  // Add more carriers as needed
};

/**
 * Fetches the complete list of carriers from our local JSON file
 * @returns A promise that resolves to an array of carrier objects
 */
export async function fetchCarrierList(): Promise<Array<{
  id: number;
  name: string;
  shortname?: string;
}>> {
  try {
    const response = await fetch(CARRIER_LIST_URL);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch carrier list: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // The API returns an object with carrier IDs as keys, transform it to an array
    if (data && typeof data === 'object') {
      const carrierArray = Object.entries(data).map(([id, details]: [string, any]) => ({
        id: parseInt(id),
        name: details.name || '',
        shortname: details.shortname || details.name
      }));
      
      // Sort carriers by name
      return carrierArray.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching carrier list:', error);
    // Fallback to hardcoded carriers if the fetch fails
    const fallbackCarriers = [
      { id: 21051, name: 'USPS', shortname: 'USPS' },
      { id: 100003, name: 'FedEx', shortname: 'FedEx' },
      { id: 100001, name: 'UPS', shortname: 'UPS' },
      { id: 7041, name: 'DHL', shortname: 'DHL' },
      { id: 7042, name: 'DHL Express', shortname: 'DHL Express' }
    ];
    return fallbackCarriers;
  }
}

/**
 * Gets the carrier code from a name or ID
 * @param carrier Carrier name or ID
 * @returns The carrier code number or 0 if not found
 */
export function getCarrierCode(carrier: string): number {
  // If the carrier is already a number, return it
  if (!isNaN(Number(carrier))) {
    return Number(carrier);
  }
  
  // Otherwise look up by name
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

export async function addTracking(orderId: string, trackingNumber: string, carrier: string = ''): Promise<OrderTracking> {
  try {
    console.log(`Adding tracking: order=${orderId}, tracking=${trackingNumber}, carrier=${carrier ? carrier : 'auto-detect'}`);
    
    // First check if this tracking number already exists - this can prevent duplicate attempts
    const { data: existingTracking, error: checkError } = await supabase
      .from('order_tracking')
      .select('id, tracking_number')
      .eq('tracking_number', trackingNumber)
      .maybeSingle();
    
    if (checkError) {
      console.warn('Error checking for existing tracking:', checkError);
      // Continue anyway to attempt the insert
    }
    
    // If tracking already exists, just return it
    if (existingTracking) {
      console.log('Tracking number already exists, skipping insert:', trackingNumber);
      return existingTracking as OrderTracking;
    }
    
    // Get the carrier name for database storage
    // We store the carrier name in the database as a string
    let carrierName = carrier || 'auto-detect';
    let carrierId = 0;
    
    // If carrier looks like a numeric ID, convert it to a name for storage
    if (!isNaN(Number(carrier))) {
      carrierId = Number(carrier);
      // We'll still store the ID as a string if we can't find the name
      carrierName = String(carrierId);
    } else if (carrier) { // Only look up ID if carrier is specified
      // If it's a name, look up the ID
      carrierId = getCarrierCode(carrier);
    }
    
    console.log(`Using carrier: ${carrierName}, ID: ${carrierId}`);
    
    // Attempt to insert with a more conservative approach
    const { data, error } = await supabase
      .from('order_tracking')
      .insert({
        order_id: orderId,
        tracking_number: trackingNumber,
        carrier: carrierName,
        last_update: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error adding tracking:', error);
      throw error;
    }
    
    // Try to register with 17TRACK via our proxy
    try {
      console.log('Registering tracking number with 17TRACK:', trackingNumber);
      
      // Use auto-detection if no carrier ID is provided
      const useAutoDetection = carrierId === 0;
      
      console.log(`Using carrier ID: ${carrierId}, auto_detection: ${useAutoDetection}`);
      
      // Use our serverless function to avoid CSP issues
      const response = await fetch(API_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          payload: {
            number: trackingNumber,
            auto_detection: useAutoDetection,
            carrier: carrierId || undefined,
            order_id: orderId
          }
        })
      });
      
      // Handle potential response issues
      if (!response.ok) {
        console.warn(`17TRACK API returned ${response.status}: ${response.statusText}`);
        return data;
      }
      
      const result = await response.json();
      console.log('17TRACK registration response:', result);
      
      if (!result.success) {
        console.warn('17TRACK registration warning:', result);
      }
    } catch (apiError) {
      // Log but don't fail if 17TRACK registration fails
      console.error('Error registering with 17TRACK:', apiError);
    }
    
    return data;
  } catch (error) {
    console.error('Error in addTracking:', error);
    
    // Check if it's a timeout error and provide a clearer message
    if (error && typeof error === 'object' && 'code' in error && error.code === '57014') {
      const timeoutError = new Error('Database timeout - tracking may still be added in the background');
      console.warn('Database timeout when adding tracking, operation may still complete:', timeoutError);
      throw timeoutError;
    }
    
    throw error;
  }
}

export async function getTrackingInfo(trackingNumber: string): Promise<OrderTracking | null> {
  try {
    // First check our database
    const { data, error } = await supabase
      .from('order_tracking')
      .select(`
        *,
        tracking_events (*)
      `)
      .eq('tracking_number', trackingNumber)
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error('Failed to fetch tracking from database');
    }
  
    // If we have data and it was updated recently (within the last hour), just return it
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  
    if (data && data.last_update && new Date(data.last_update) > oneHourAgo) {
      return data;
    }
  
    // Otherwise, try to get fresh data from 17TRACK via our proxy
    try {
      const response = await fetch(API_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          action: 'status',
          payload: {
            number: trackingNumber
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
    
      const result = await response.json();
    
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch tracking from API');
      }
    
      if (result.data && result.data.accepted && result.data.accepted.length > 0) {
        const trackData = result.data.accepted[0];
      
        // Update our database with the latest tracking info
        if (trackData && trackData.track) {
          const track = trackData.track;
          const status = mapTrackingStatus(track.e);
        
          // Update the tracking record
          await updateTrackingStatus(
            trackingNumber,
            status,
            track.z0?.c,
            track.z1?.a
          );
        
          // Add tracking events if available
          if (track.z2 && Array.isArray(track.z2) && data && data.id) {
            for (const event of track.z2) {
              await addTrackingEvent(data.id, {
                status: event.z,
                details: event.c,
                location: event.l,
                timestamp: event.a
              });
            }
          }
        
          // Fetch the updated record
          const { data: updatedData, error: updateError } = await supabase
            .from('order_tracking')
            .select(`
              *,
              tracking_events (*)
            `)
            .eq('tracking_number', trackingNumber)
            .single();
          
          if (updateError) {
            console.error('Error fetching updated tracking:', updateError);
            throw new Error('Failed to fetch updated tracking');
          }
          
          return updatedData;
        }
      }
      
      // If we get here, no valid tracking data was found
      throw new Error('No tracking information available');
    } catch (apiError) {
      console.error('Error fetching tracking from API:', apiError);
      // If we have stale data, return it as fallback
      if (data) {
        console.log('Falling back to database data');
        return data;
      }
      throw new Error('Failed to fetch tracking information. Please try again later.');
    }
  } catch (error) {
    console.error('Error in getTrackingInfo:', error);
    throw error;
  }
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
      // Use our serverless function proxy to avoid CSP issues
      const apiResponse = await fetch(API_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          payload: {
            number: trackingNumber,
            carrier // Optional carrier code
          }
        })
      });

      const result = await apiResponse.json();
      
      if (result.success) {
        apiSuccess = true;
      } else {
        errorMessage += errorMessage ? ` | API error: ${result.message || 'Unknown API error'}` : `API error: ${result.message || 'Unknown API error'}`;
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