import { useState, useEffect, useRef } from 'react';
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
  const lastCheckedRef = useRef<number>(Date.now());
  const checkIntervalRef = useRef<any>(null);
  const retryTimeoutRef = useRef<any>(null);
  const consecutiveErrorsRef = useRef<number>(0);

  useEffect(() => {
    // Function to check realtime connection status
    const checkRealtimeStatus = () => {
      try {
        // Record when we last checked
        lastCheckedRef.current = Date.now();
        
        // Access realtime transport if available
        const transport = (supabase.realtime as any)?.transport;
        
        if (!transport) {
          console.warn('Realtime transport not available');
          handleConnectionIssue();
          return;
        }
        
        const connectionState = transport.connectionState;
        
        if (connectionState === 'open') {
          setStatus('connected');
          consecutiveErrorsRef.current = 0;
        } else if (connectionState === 'connecting') {
          setStatus('connecting');
          
          // If connecting for too long, consider it disconnected
          if (consecutiveErrorsRef.current > 2) {
            setStatus('disconnected');
          }
        } else {
          handleConnectionIssue();
        }
      } catch (err) {
        console.error('Error checking realtime status:', err);
        handleConnectionIssue();
      }
    };
    
    const handleConnectionIssue = () => {
      consecutiveErrorsRef.current++;
      
      if (consecutiveErrorsRef.current > 3) {
        setStatus('disconnected');
      } else {
        setStatus('connecting');
      }
      
      // If we've detected several issues, try to force reconnect
      if (consecutiveErrorsRef.current === 5) {
        forceReconnect();
      }
    };
    
    // Force a reconnection attempt
    const forceReconnect = () => {
      try {
        console.log('Attempting to force reconnect Supabase realtime...');
        
        // Cancel any existing retry attempt
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        
        // Disconnect and reconnect
        const realtimeClient = (supabase.realtime as any);
        if (realtimeClient?.disconnect) {
          realtimeClient.disconnect();
          
          // Wait a bit before reconnecting
          retryTimeoutRef.current = setTimeout(() => {
            if (realtimeClient?.connect) {
              realtimeClient.connect();
              
              // Reset counter after reconnect attempt
              consecutiveErrorsRef.current = 0;
            }
          }, 2000);
        }
      } catch (err) {
        console.error('Failed to force reconnect:', err);
      }
    };
    
    // Check status immediately
    checkRealtimeStatus();
    
    // Set up interval to check status
    checkIntervalRef.current = setInterval(checkRealtimeStatus, 10000);
    
    // Clean up interval and timeout
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
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