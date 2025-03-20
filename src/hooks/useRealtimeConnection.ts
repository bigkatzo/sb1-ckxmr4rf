import { useEffect, useState } from 'react';
import { ConnectionManager, ConnectionState } from '../lib/realtime/ConnectionManager';
import { supabase } from '../lib/supabase';

export function useRealtimeConnection() {
  const [state, setState] = useState<ConnectionState>({
    status: 'connecting',
    lastHealthCheck: Date.now(),
    error: null
  });

  useEffect(() => {
    const manager = ConnectionManager.getInstance(supabase);
    
    // Subscribe to connection state changes
    const subscription = manager.getState().subscribe(setState);
    
    // Cleanup subscription
    return () => subscription.unsubscribe();
  }, []);

  return state;
} 