import React, { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';

export function ConnectionDebugger() {
  const { 
    isConnected, 
    walletAddress, 
    authenticated, 
    user, 
    error, 
    notifications 
  } = useWallet();
  
  const [connectionLog, setConnectionLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setConnectionLog(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Monitor connection state changes
  useEffect(() => {
    addLog(`Connection State: isConnected=${isConnected}, authenticated=${authenticated}`);
  }, [isConnected, authenticated]);

  // Monitor wallet address changes
  useEffect(() => {
    if (walletAddress) {
      addLog(`Wallet Address: ${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}`);
    } else {
      addLog('Wallet Address: null');
    }
  }, [walletAddress]);

  // Monitor user object changes
  useEffect(() => {
    if (user?.wallet) {
      addLog(`User Wallet: chainId=${user.wallet.chainId}, chainType=${user.wallet.chainType}`);
    } else {
      addLog('User Wallet: null');
    }
  }, [user?.wallet]);

  // Monitor error changes
  useEffect(() => {
    if (error) {
      addLog(`Error: ${error.message}`);
    }
  }, [error]);

  // Monitor notifications
  useEffect(() => {
    if (notifications.length > 0) {
      const latestNotification = notifications[notifications.length - 1];
      addLog(`Notification: ${latestNotification.type} - ${latestNotification.message}`);
    }
  }, [notifications]);

  const clearLog = () => {
    setConnectionLog([]);
  };

  const getConnectionStatus = () => {
    return {
      isConnected,
      authenticated,
      hasWalletAddress: !!walletAddress,
      hasUser: !!user,
      hasError: !!error,
      notificationCount: notifications.length
    };
  };

  const status = getConnectionStatus();

  return (
    <div className="p-4 bg-gray-900 text-white rounded-lg max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Connection Debugger</h2>
      
      {/* Connection Status */}
      <div className="mb-4 p-3 bg-gray-800 rounded">
        <h3 className="font-semibold mb-2">Connection Status</h3>
        <div className="text-sm space-y-1">
          <div>Connected: {status.isConnected ? '✅ Yes' : '❌ No'}</div>
          <div>Authenticated: {status.authenticated ? '✅ Yes' : '❌ No'}</div>
          <div>Has Wallet Address: {status.hasWalletAddress ? '✅ Yes' : '❌ No'}</div>
          <div>Has User: {status.hasUser ? '✅ Yes' : '❌ No'}</div>
          <div>Has Error: {status.hasError ? '❌ Yes' : '✅ No'}</div>
          <div>Notifications: {status.notificationCount}</div>
        </div>
      </div>

      {/* Current Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900 rounded">
          <h3 className="font-semibold mb-2">Current Error</h3>
          <div className="text-sm text-red-200">
            {error.message}
          </div>
        </div>
      )}

      {/* Latest Notifications */}
      {notifications.length > 0 && (
        <div className="mb-4 p-3 bg-gray-800 rounded">
          <h3 className="font-semibold mb-2">Latest Notifications</h3>
          <div className="text-sm space-y-1">
            {notifications.slice(-3).map((notification, index) => (
              <div key={notification.id} className={`p-2 rounded ${
                notification.type === 'error' ? 'bg-red-900' : 
                notification.type === 'success' ? 'bg-green-900' : 'bg-blue-900'
              }`}>
                <div className="font-semibold">{notification.type.toUpperCase()}</div>
                <div>{notification.message}</div>
                <div className="text-xs opacity-75">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={clearLog}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm"
        >
          Clear Log
        </button>
      </div>

      {/* Connection Log */}
      <div className="bg-black p-3 rounded font-mono text-xs max-h-96 overflow-y-auto">
        <h3 className="font-semibold mb-2">Connection Log</h3>
        {connectionLog.length === 0 ? (
          <div className="text-gray-500">No connection events logged yet.</div>
        ) : (
          connectionLog.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
} 