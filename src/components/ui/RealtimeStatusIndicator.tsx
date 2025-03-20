import { useRealtimeConnection } from '../../hooks/useRealtimeConnection';

interface RealtimeStatusIndicatorProps {
  compact?: boolean;
  className?: string;
}

export function RealtimeStatusIndicator({ 
  compact = false, 
  className = '' 
}: RealtimeStatusIndicatorProps) {
  const { status, error } = useRealtimeConnection();
  
  return (
    <div className={`flex items-center ${className}`}>
      <div 
        className={`w-2 h-2 rounded-full ${
          status === 'connected' ? 'bg-green-500' :
          status === 'connecting' ? 'bg-yellow-500' :
          'bg-red-500'
        }`}
        title={error?.message}
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