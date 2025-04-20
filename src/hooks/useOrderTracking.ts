import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { OrderTracking } from '../types/orders';

interface UseOrderTrackingProps {
  orderId?: string;
  trackingId?: string;
  trackingNumber?: string;
}

interface UseOrderTrackingResult {
  tracking: OrderTracking | null;
  loading: boolean;
  error: string | null;
  refreshTracking: () => void;
}

export function useOrderTracking({
  orderId,
  trackingId,
  trackingNumber
}: UseOrderTrackingProps): UseOrderTrackingResult {
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch tracking data
  const fetchTracking = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build the query based on available parameters
      let query = supabase.from('order_tracking').select(`
        *,
        tracking_events(*)
      `);

      // Apply filters based on provided parameters
      if (orderId) {
        query = query.eq('order_id', orderId);
      } else if (trackingId) {
        query = query.eq('id', trackingId);
      } else if (trackingNumber) {
        query = query.eq('tracking_number', trackingNumber);
      } else {
        throw new Error('At least one of orderId, trackingId, or trackingNumber must be provided');
      }

      // Execute the query
      const { data, error: queryError } = await query.single();

      if (queryError) {
        console.error('Error fetching tracking:', queryError);
        setError(queryError.message);
        return;
      }

      if (!data) {
        setTracking(null);
        return;
      }

      // Transform the data to match OrderTracking interface
      const trackingData: OrderTracking = {
        id: data.id,
        order_id: data.order_id,
        tracking_number: data.tracking_number,
        carrier: data.carrier,
        status: data.status || undefined,
        status_details: data.status_details || undefined,
        estimated_delivery_date: data.estimated_delivery_date || undefined,
        last_update: data.last_update || undefined,
        created_at: data.created_at,
        updated_at: data.updated_at,
        tracking_events: data.tracking_events || []
      };

      setTracking(trackingData);
    } catch (err) {
      console.error('Exception fetching tracking:', err);
      setError(err instanceof Error ? err.message : 'Unknown error fetching tracking');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when params change
  useEffect(() => {
    if (orderId || trackingId || trackingNumber) {
      fetchTracking();
    } else {
      setTracking(null);
      setLoading(false);
      setError(null);
    }
  }, [orderId, trackingId, trackingNumber]);

  return {
    tracking,
    loading,
    error,
    refreshTracking: fetchTracking
  };
} 