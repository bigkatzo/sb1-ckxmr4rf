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
    <div className="w-full bg-gray-900/50 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg
              ${notification.type === 'success' ? 'bg-green-500/20 text-green-400' : 
                notification.type === 'info' ? 'bg-gray-500/20 text-gray-400' : 'bg-red-500/20 text-red-400'}
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
              <p className="text-xs sm:text-sm">{notification.message}</p>
            </div>

            <button
              onClick={() => onDismiss(notification.id)}
              className="flex-shrink-0 opacity-60 hover:opacity-100 p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}