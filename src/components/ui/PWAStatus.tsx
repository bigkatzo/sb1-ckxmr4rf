import { CheckCircle, XCircle, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

export function PWAStatus() {
  const { isInstalled, isOnline, hasServiceWorker, displayMode } = usePWA();

  // Only show in development or when there are issues
  if (import.meta.env.PROD && isInstalled && isOnline && hasServiceWorker) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 max-w-xs">
      <div className="flex items-center space-x-2 mb-2">
        <Smartphone className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-900 dark:text-white">PWA Status</span>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Installed:</span>
          {isInstalled ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-gray-400" />
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Online:</span>
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Service Worker:</span>
          {hasServiceWorker ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-gray-400" />
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Display Mode:</span>
          <span className="text-gray-900 dark:text-white capitalize">
            {displayMode.replace('-', ' ')}
          </span>
        </div>
      </div>
      
      {!isInstalled && (
        <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Install this app for a better experience
          </p>
        </div>
      )}
    </div>
  );
} 