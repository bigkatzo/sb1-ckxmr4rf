import { useState } from 'react';

interface CreateTrackingParams {
  tracking_number: string;
  tracking_provider: string;
  order_id: string;
  postal_code?: string;
  destination_country?: string;
}

interface TrackingResponse {
  status: string;
  status_msg: string;
  trackers_balance: string;
  user_plan: string;
}

export function useCreateTracking() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTracking = async (params: CreateTrackingParams): Promise<TrackingResponse | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/.netlify/functions/create-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create tracking');
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create tracking';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    createTracking,
    loading,
    error,
  };
} 