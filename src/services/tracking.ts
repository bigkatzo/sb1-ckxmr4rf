import { supabase } from '../lib/supabase';
import { OrderTracking } from '../types/orders';

// API proxy endpoint for frontend calls to avoid CSP issues
const API_PROXY_URL = process.env.NODE_ENV === 'production' 
  ? 'https://store.fun/.netlify/functions/tracking-api-proxy'
  : '/.netlify/functions/tracking-api-proxy';

// Local carrier list URL (to avoid CSP issues)
const CARRIER_LIST_URL = '/data/carriers.json';

// 17TRACK API carrier codes - automatically populated from carriers.json
export const CARRIER_CODES: Record<string, number> = {
  // Common carriers
  usps: 21051,
  fedex: 100003,
  ups: 100001,
  dhl: 7041,
  'dhl-express': 7042,
  'dhl-global-mail': 7043,
  'dhl-ecommerce': 7047,
  'dhl-parcel': 7041,
  'china-post': 190094,
  'china-ems': 190093,
  'singapore-post': 13001,
  'royal-mail': 100027,
  'australia-post': 100004,
  'canada-post': 100009,
  'japan-post': 100015,
  'la-poste': 6051,
  'postnl': 100026,
  'deutsche-post': 7044,
  'swiss-post': 100024,
  'hong-kong-post': 100010,
  'thailand-post': 100030,
  'malaysia-post': 100012,
  'india-post': 100011,
  'korea-post': 100016,
  'new-zealand-post': 100013,
  'brazil-correios': 2151,
  'russian-post': 100019,
  'taiwan-post': 100029,
  'vietnam-post': 100032,
  'israel-post': 100014,
  'italy-post': 100025,
  'spain-correos': 100023,
  'turkey-post': 100031,
  'philippines-post': 100017,
  'indonesia-post': 100033,
  
  // Additional carriers from carriers.json
  'bpost': 2061,
  'bpost-international': 2063,
  'posti': 6041,
  'la-poste-colissimo': 6051,
  'dhl-paket': 7041,
  'dhl-ecommerce-us': 7047,
  'dhl-ecommerce-asia': 7048,
  'j&t-international': 100295,
  'ninja-van-international': 100597,
  'amazon-shipping-in': 100417,
  'amazon-shipping-fr': 101001,
  'amazon-shipping-es': 101081,
  'shopee-express-ph': 100519,
  'shopee-express-my': 100408,
  'shopee-express-id': 100409,
  'shopee-express-th': 100410,
  'lazada-logistics-vn': 100997
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
  
  // Clean up carrier name for matching
  const cleanCarrier = carrier.toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove special characters
    .replace(/\s+/g, ''); // Remove spaces
  
  // Try exact match first
  if (CARRIER_CODES[cleanCarrier]) {
    return CARRIER_CODES[cleanCarrier];
  }
  
  // Try fuzzy matching by checking if carrier name contains any of our known carriers
  for (const [knownCarrier, code] of Object.entries(CARRIER_CODES)) {
    const cleanKnownCarrier = knownCarrier.replace(/[^a-z0-9]/g, '');
    if (cleanCarrier.includes(cleanKnownCarrier) || cleanKnownCarrier.includes(cleanCarrier)) {
      return code;
    }
  }
  
  // Return 0 if no match found (will trigger auto-detection)
  return 0;
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
    
    // First check if this tracking number already exists
    const { data: existingTracking, error: checkError } = await supabase
      .from('order_tracking')
      .select('*')
      .eq('tracking_number', trackingNumber)
      .maybeSingle();
    
    if (checkError) {
      console.warn('Error checking for existing tracking:', checkError);
      // Continue anyway to attempt the insert
    }
    
    // If tracking already exists, associate it with the new order without re-registering
    if (existingTracking) {
      console.log('Tracking number already exists, associating with new order:', trackingNumber);
      
      // Create a new tracking entry for this order using existing tracking info
      const { data: newTracking, error: insertError } = await supabase
        .from('order_tracking')
        .insert({
          order_id: orderId,
          tracking_number: trackingNumber,
          carrier: existingTracking.carrier,
          status: existingTracking.status,
          status_details: existingTracking.status_details,
          estimated_delivery_date: existingTracking.estimated_delivery_date,
          latest_event_info: existingTracking.latest_event_info,
          latest_event_time: existingTracking.latest_event_time,
          carrier_details: existingTracking.carrier_details,
          last_update: existingTracking.last_update
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating new tracking entry:', insertError);
        throw insertError;
      }

      return newTracking;
    }
    
    // Before inserting, check if the user has permission to add tracking to this order
    // First get the order with its collection
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, collection_id')
      .eq('id', orderId)
      .single();
      
    if (orderError || !orderData) {
      console.error('Error fetching order for permission check:', orderError);
      throw new Error('Order not found or permission denied');
    }
    
    // Now check if the user has access to the collection
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Authentication required');
    
    // Get user profile to check if admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    const isAdmin = userProfile?.role === 'admin';
    
    if (!isAdmin) {
      // Check collection ownership
      const { data: collection, error: collectionError } = await supabase
        .from('collections')
        .select('user_id')
        .eq('id', orderData.collection_id)
        .single();
        
      if (collectionError) {
        console.error('Error checking collection ownership:', collectionError);
        throw new Error('Failed to verify collection access');
      }
      
      const isOwner = collection.user_id === user.id;
      
      if (!isOwner) {
        // Check for edit access if not owner
        const { data: accessData, error: accessError } = await supabase
          .from('collection_access')
          .select('access_type')
          .eq('collection_id', orderData.collection_id)
          .eq('user_id', user.id)
          .single();
          
        if (accessError || !accessData || accessData.access_type !== 'edit') {
          console.error('Permission denied: User does not have edit access to this collection');
          throw new Error('Access denied: Edit permission required to update tracking');
        }
      }
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
    
    // Insert new tracking entry
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
    
    // For new tracking numbers, register with 17TRACK
    try {
      console.log('Registering new tracking number with 17TRACK:', trackingNumber);
      
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
        if (trackData && trackData.track_info) {
          const trackInfo = trackData.track_info;
          const status = trackInfo.latest_status?.status || 'NotFound';
          
          // Get the latest event details
          const latestEvent = trackInfo.latest_event;
          const latestEventInfo = latestEvent?.description || '';
          const latestEventTime = latestEvent?.time_utc;
          const estimatedDeliveryDate = trackInfo.time_metrics?.estimated_delivery_date?.from;
        
          // Get carrier details
          const carrierDetails = {
            name: trackInfo.carrier_info?.name,
            carrier_code: trackInfo.carrier_info?.code,
            service_type: trackInfo.service_type?.name
          };
        
          // Update the tracking record with enhanced information
          await updateTrackingStatus(
            trackingNumber,
            status,
            trackInfo.latest_status?.sub_status,
            estimatedDeliveryDate,
            latestEventTime,
            latestEventInfo,
            carrierDetails
          );
        
          // Add tracking events if available
          if (trackInfo.tracking?.providers?.[0]?.events && data && data.id) {
            const events = trackInfo.tracking.providers[0].events;
            for (const event of events) {
              await addTrackingEvent(data.id, {
                status: event.stage || event.sub_status || status,
                details: event.description,
                location: event.location,
                timestamp: event.time_utc
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
  estimatedDeliveryDate?: string,
  latestEventTime?: string,
  latestEventInfo?: string,
  carrierDetails?: Record<string, any>
): Promise<void> {
  const { error } = await supabase
    .from('order_tracking')
    .update({
      status,
      status_details: statusDetails,
      estimated_delivery_date: estimatedDeliveryDate,
      latest_event_time: latestEventTime,
      latest_event_info: latestEventInfo,
      last_update: new Date().toISOString(),
      carrier_details: carrierDetails
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
    // First, get the tracking record to verify the order_id
    const { data: trackingData, error: trackingError } = await supabase
      .from('order_tracking')
      .select('id, order_id')
      .eq('tracking_number', trackingNumber)
      .single();
      
    if (trackingError || !trackingData) {
      return {
        success: false,
        message: 'Tracking number not found',
        dbSuccess: false,
        apiSuccess: false
      };
    }
    
    // Get the order's collection to check permissions
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, collection_id')
      .eq('id', trackingData.order_id)
      .single();
      
    if (orderError || !orderData) {
      return {
        success: false,
        message: 'Order not found',
        dbSuccess: false,
        apiSuccess: false
      };
    }
    
    // Check user permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        message: 'Authentication required',
        dbSuccess: false,
        apiSuccess: false
      };
    }
    
    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    const isAdmin = userProfile?.role === 'admin';
    
    if (!isAdmin) {
      // Check collection ownership
      const { data: collection, error: collectionError } = await supabase
        .from('collections')
        .select('user_id')
        .eq('id', orderData.collection_id)
        .single();
        
      if (collectionError) {
        return {
          success: false,
          message: 'Failed to verify collection access',
          dbSuccess: false,
          apiSuccess: false
        };
      }
      
      const isOwner = collection.user_id === user.id;
      
      if (!isOwner) {
        // Check for edit access
        const { data: accessData, error: accessError } = await supabase
          .from('collection_access')
          .select('access_type')
          .eq('collection_id', orderData.collection_id)
          .eq('user_id', user.id)
          .single();
          
        if (accessError || !accessData || accessData.access_type !== 'edit') {
          return {
            success: false,
            message: 'Access denied: Edit permission required to delete tracking',
            dbSuccess: false,
            apiSuccess: false
          };
        }
      }
    }

    // Delete from our database now that permissions are verified
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