import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { isRealtimeConnectionHealthy } from '../../lib/realtime/subscriptions';
import { Button } from './Button';

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export function RealtimeStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    // Check current status immediately
    checkStatus();

    // Set up regular status check
    const intervalId = setInterval(checkStatus, 10000);
    
    return () => clearInterval(intervalId);
    
    function checkStatus() {
      try {
        // Get client with safer type assertion
        const realtimeClient = (supabase.realtime as any);
        
        // First check our more accurate connection health
        if (isRealtimeConnectionHealthy()) {
          setStatus('connected');
          return;
        }
        
        // Fallback to transport check if needed
        if (realtimeClient?.transport?.connectionState === 'open') {
          setStatus('connected');
        } else if (realtimeClient?.transport?.connectionState === 'connecting') {
          setStatus('connecting');
        } else {
          // Any other state or undefined is considered disconnected
          setStatus('disconnected');
        }
      } catch (error) {
        console.error('Error checking realtime status:', error);
        setStatus('disconnected');
      }
    }
  }, []);

  const handleRefresh = () => {
    // When disconnected, reload page to re-establish connection
    if (status === 'disconnected') {
      window.location.reload();
    }
  };

  return (
    <div className="fixed right-4 top-20 z-50 flex items-center gap-2 bg-background/80 p-2 rounded shadow-sm">
      <div className="flex items-center gap-2">
        <div 
          className={`w-3 h-3 rounded-full ${
            status === 'connected' 
              ? 'bg-green-500' 
              : status === 'connecting' 
                ? 'bg-yellow-500' 
                : 'bg-red-500'
          }`}
        />
        <span className="text-xs font-medium">
          {status === 'connected' 
            ? 'Realtime: Connected' 
            : status === 'connecting' 
              ? 'Realtime: Connecting' 
              : 'Realtime: Disconnected'}
        </span>
      </div>
      {status === 'disconnected' && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 w-6 rounded-full" 
          onClick={handleRefresh}
          title="Refresh page"
        >
          <RefreshIcon className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function RefreshIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
} 