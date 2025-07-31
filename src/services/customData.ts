import { supabase } from '../lib/supabase';

export interface CustomData {
  id: string;
  order_id: string;
  product_id: string;
  wallet_address: string;
  customizable_image: string | null;
  customizable_text: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch custom data for a specific order
 */
export async function getCustomDataForOrder(orderId: string): Promise<CustomData | null> {
  try {
    const { data, error } = await supabase
      .from('custom_data')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - no customization data exists
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching custom data for order:', error);
    throw error;
  }
}

/**
 * Fetch custom data for multiple orders
 */
export async function getCustomDataForOrders(orderIds: string[]): Promise<Record<string, CustomData>> {
  try {
    if (orderIds.length === 0) {
      return {};
    }

    const { data, error } = await supabase
      .from('custom_data')
      .select('*')
      .in('order_id', orderIds);

    if (error) {
      throw error;
    }

    // Convert array to object keyed by order_id
    const customDataMap: Record<string, CustomData> = {};
    (data || []).forEach(customData => {
      customDataMap[customData.order_id] = customData;
    });

    return customDataMap;
  } catch (error) {
    console.error('Error fetching custom data for orders:', error);
    throw error;
  }
} 