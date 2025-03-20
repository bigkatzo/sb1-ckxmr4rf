import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

type RealtimeStatus = 'connected' | 'connecting' | 'disconnected';

interface RealtimeStatusIndicatorProps {
  compact?: boolean;
  className?: string;
}

export function RealtimeStatusIndicator({ 
  compact = false, 
  className = '' 
}: RealtimeStatusIndicatorProps) {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');

  useEffect(() => {
    // Function to check realtime connection status
    const checkRealtimeStatus = () => {
      try {
        // Access realtime transport if available
        const transport = (supabase.realtime as any)?.transport;
        
        if (!transport) {
          setStatus('disconnected');
          return;
        }
        
        const connectionState = transport.connectionState;
        
        if (connectionState === 'open') {
          setStatus('connected');
        } else if (connectionState === 'connecting') {
          setStatus('connecting');
        } else {
          setStatus('disconnected');
        }
      } catch (err) {
        console.error('Error checking realtime status:', err);
        setStatus('disconnected');
      }
    };
    
    // Check status immediately
    checkRealtimeStatus();
    
    // Set up interval to check status
    const interval = setInterval(checkRealtimeStatus, 10000);
    
    // Clean up interval
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className={`flex items-center ${className}`}>
      <div 
        className={`w-2 h-2 rounded-full ${
          status === 'connected' ? 'bg-green-500' :
          status === 'connecting' ? 'bg-yellow-500' :
          'bg-red-500'
        }`}
      />
      {!compact && (
        <span className="ml-1.5 text-xs">
          {status === 'connected' ? 'Live' :
           status === 'connecting' ? 'Connecting' :
           'Offline'}
        </span>
      )}
    </div>
  );
} 