import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

type RealtimeStatus = 'connected' | 'connecting' | 'disconnected';

export function RealtimeStatus() {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const [showRefreshButton, setShowRefreshButton] = useState(false);

  useEffect(() => {
    // Function to check realtime connection status
    const checkRealtimeStatus = () => {
      try {
        // Access realtime transport if available
        const transport = (supabase.realtime as any)?.transport;
        
        if (!transport) {
          setStatus('disconnected');
          setShowRefreshButton(true);
          return;
        }
        
        const connectionState = transport.connectionState;
        
        if (connectionState === 'open') {
          setStatus('connected');
          setShowRefreshButton(false);
        } else if (connectionState === 'connecting') {
          setStatus('connecting');
          setShowRefreshButton(false);
        } else {
          setStatus('disconnected');
          setShowRefreshButton(true);
        }
      } catch (err) {
        console.error('Error checking realtime status:', err);
        setStatus('disconnected');
        setShowRefreshButton(true);
      }
    };
    
    // Check status immediately
    checkRealtimeStatus();
    
    // Set up interval to check status
    const interval = setInterval(checkRealtimeStatus, 10000);
    
    // Clean up interval
    return () => clearInterval(interval);
  }, []);
  
  // Function to refresh the page
  const handleRefresh = () => {
    window.location.reload();
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center space-x-2 bg-gray-800 rounded-full px-3 py-1 text-xs text-white shadow-lg">
      <div className="flex items-center">
        <div 
          className={`w-2 h-2 rounded-full mr-1 ${
            status === 'connected' ? 'bg-green-500' :
            status === 'connecting' ? 'bg-yellow-500' :
            'bg-red-500'
          }`}
        />
        <span>
          {status === 'connected' ? 'Live' :
           status === 'connecting' ? 'Connecting...' :
           'Offline'}
        </span>
      </div>
      
      {showRefreshButton && (
        <>
          <div className="h-4 w-px bg-gray-600" />
          <button 
            onClick={handleRefresh}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            Refresh
          </button>
        </>
      )}
    </div>
  );
} 