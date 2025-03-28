import { Check, AlertCircle, Info } from 'lucide-react';

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
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 max-w-[280px] sm:max-w-md w-auto z-[60] space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm
            ${notification.type === 'success' ? 'bg-green-500/90' : 
              notification.type === 'info' ? 'bg-gray-500/90' : 'bg-red-500/90'}
            transition-all duration-200
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
            onClick={() => onDismiss(notification.id)}
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