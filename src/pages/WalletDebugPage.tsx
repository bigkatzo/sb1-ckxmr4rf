import React from 'react';
import { WalletDebugger } from '../components/wallet/WalletDebugger';
import { useWallet } from '../contexts/WalletContext';

export function WalletDebugPage() {
  const { isConnected, walletAddress, connect, disconnect, ready, authenticated, user } = useWallet();

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privy Wallet Debug Page</h1>
        
        {/* Comprehensive Wallet Debugger */}
        <div className="mb-6">
          <WalletDebugger />
        </div>

        {/* Current Wallet Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Wallet Status</h2>
          <div className="space-y-2">
            <p><strong>Ready:</strong> {ready ? 'Yes' : 'No'}</p>
            <p><strong>Authenticated:</strong> {authenticated ? 'Yes' : 'No'}</p>
            <p><strong>Connected:</strong> {isConnected ? 'Yes' : 'No'}</p>
            <p><strong>Wallet Address:</strong> {walletAddress || 'Not connected'}</p>
            <p><strong>User Type:</strong> {user?.type || 'None'}</p>
            <p><strong>Linked Accounts:</strong> {user?.linkedAccounts?.length || 0}</p>
          </div>
          <div className="mt-4 space-x-2">
            <button
              onClick={connect}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Connect Wallet
            </button>
            <button
              onClick={disconnect}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* User Information */}
        {user && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">User Information</h2>
            <div className="space-y-2">
              <p><strong>User ID:</strong> {user.id}</p>
              <p><strong>Type:</strong> {user.type}</p>
              {user.wallet && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Wallet Details:</h3>
                  <p><strong>Type:</strong> {user.wallet.type}</p>
                  <p><strong>Address:</strong> {user.wallet.address}</p>
                  <p><strong>Chain ID:</strong> {user.wallet.chainId}</p>
                </div>
              )}
              {user.linkedAccounts && user.linkedAccounts.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Linked Accounts:</h3>
                  <div className="space-y-1">
                    {user.linkedAccounts.map((account: any, index: number) => (
                      <div key={index} className="text-sm">
                        <strong>{account.type}:</strong> {account.address || 'No address'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Environment Information */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Environment Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>User Agent:</strong> {navigator.userAgent}</p>
            <p><strong>Platform:</strong> {navigator.platform}</p>
            <p><strong>Language:</strong> {navigator.language}</p>
            <p><strong>URL:</strong> {window.location.href}</p>
            <p><strong>Referrer:</strong> {document.referrer || 'None'}</p>
            <p><strong>OnLine:</strong> {navigator.onLine ? 'Yes' : 'No'}</p>
            <p><strong>Privy App ID:</strong> {import.meta.env.VITE_PRIVY_APP_ID || 'Not set'}</p>
            <p><strong>WalletConnect Project ID:</strong> {import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'Not set'}</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-900">Testing Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Use the "Privy Wallet Debugger" at the top for comprehensive testing and debugging</li>
            <li>Run the "Full Test" to get detailed information about your environment and Privy status</li>
            <li>Use the "Connect Wallet" button to initiate wallet connection</li>
            <li>Use "Privy Login" to test the Privy authentication flow</li>
            <li>Use "Privy Logout" to test the logout flow</li>
            <li>Monitor the "Current State" section to see real-time Privy status</li>
            <li>Check the "User Information" section for detailed user data</li>
            <li>Check the console for detailed debug information</li>
            <li>Ensure your Privy App ID and WalletConnect Project ID are set in environment variables</li>
          </ol>
        </div>
      </div>
    </div>
  );
} 