import { useEffect, useRef, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createRobustChannel } from '../lib/realtime/subscriptions';

type ChannelState = {
  connected: boolean;
  status: string;
  error: string | null;
};

interface UseRobustChannelOptions {
  channelName: string;
  maxReconnectAttempts?: number;
  config?: Record<string, any>;
  onMaxRetriesExceeded?: () => void;
}

/**
 * A hook that provides a robust channel subscription with reconnection logic
 * and status tracking.
 */
export function useRobustChannel({
  channelName,
  maxReconnectAttempts = 5,
  config = { broadcast: { self: true } },
  onMaxRetriesExceeded
}: UseRobustChannelOptions): {
  channel: RealtimeChannel | null;
  state: ChannelState;
} {
  const [state, setState] = useState<ChannelState>({
    connected: false,
    status: 'INITIALIZING',
    error: null
  });
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  useEffect(() => {
    // Create a robust channel for this subscription
    const { channel, subscribe } = createRobustChannel(
      channelName,
      config,
      maxReconnectAttempts
    );
    
    // Store the channel for external access
    channelRef.current = channel;
    
    // Subscribe with status tracking
    const subscription = subscribe((status: any) => {
      if (status.connected) {
        setState({
          connected: true,
          status: 'SUBSCRIBED',
          error: null
        });
      } else if (status.status === 'MAX_RETRIES_EXCEEDED') {
        setState({
          connected: false,
          status: 'MAX_RETRIES_EXCEEDED',
          error: 'Maximum reconnection attempts reached'
        });
        
        // Call callback if provided
        if (onMaxRetriesExceeded) {
          onMaxRetriesExceeded();
        }
      } else {
        setState({
          connected: false,
          status: status.status || 'UNKNOWN',
          error: status.error || null
        });
      }
    });
    
    // Cleanup on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [channelName, config, maxReconnectAttempts, onMaxRetriesExceeded]);
  
  return {
    channel: channelRef.current,
    state
  };
} 