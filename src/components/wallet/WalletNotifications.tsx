import { Check, AlertCircle, Info } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface WalletNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: number;
}

interface WalletNotificationsProps {
  notifications: WalletNotification[];
  onDismiss: (id: string) => void;
}

export function WalletNotifications({ notifications, onDismiss }: WalletNotificationsProps) {
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timeouts when component unmounts or notifications change
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  // Set up auto-dismiss for new notifications
  useEffect(() => {
    notifications.forEach((notification) => {
      // Skip if timeout already exists for this notification
      if (timeoutRefs.current.has(notification.id)) {
        return;
      }

      // Set timeout to auto-dismiss after 3 seconds
      const timeout = setTimeout(() => {
        onDismiss(notification.id);
        timeoutRefs.current.delete(notification.id);
      }, 3000);

      timeoutRefs.current.set(notification.id, timeout);
    });

    // Clean up timeouts for notifications that no longer exist
    const currentIds = new Set(notifications.map(n => n.id));
    timeoutRefs.current.forEach((timeout, id) => {
      if (!currentIds.has(id)) {
        clearTimeout(timeout);
        timeoutRefs.current.delete(id);
      }
    });
  }, [notifications, onDismiss]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-14 right-4 sm:right-12 max-w-[280px] sm:max-w-md w-auto z-[60] space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm
            ${notification.type === 'success' ? 'bg-green-500/90 text-white' : 
              notification.type === 'info' ? 'bg-blue-500/90 text-white' : 'bg-red-500/90 text-white'}
            transition-all duration-200 animate-in slide-in-from-right-2
          `}
        >
          <div className="flex-shrink-0">
            {notification.type === 'success' ? (
              <Check className="h-4 w-4" />
            ) : notification.type === 'info' ? (
              <Info className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm truncate">{notification.message}</p>
          </div>

          <button
            onClick={() => {
              // Clear the timeout when manually dismissed
              const timeout = timeoutRefs.current.get(notification.id);
              if (timeout) {
                clearTimeout(timeout);
                timeoutRefs.current.delete(notification.id);
              }
              onDismiss(notification.id);
            }}
            className="flex-shrink-0 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}