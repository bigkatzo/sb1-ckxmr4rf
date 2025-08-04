import React from 'react';
import { MobileWalletTest } from '../components/wallet/MobileWalletTest';
import { SeamlessWalletButton, WalletConnectionStatus } from '../components/wallet/SeamlessWalletButton';
import { useWallet } from '../contexts/WalletContext';
import { useSeamlessWallet } from '../hooks/useSeamlessWallet';

export function WalletDebugPage() {
  const { isConnected, walletAddress, connect, disconnect } = useWallet();
  const { availableWallets, connectionStates } = useSeamlessWallet();

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Wallet Debug Page</h1>
        
        {/* Current Wallet Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Wallet Status</h2>
          <div className="space-y-2">
            <p><strong>Connected:</strong> {isConnected ? 'Yes' : 'No'}</p>
            <p><strong>Wallet Address:</strong> {walletAddress || 'Not connected'}</p>
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

        {/* Seamless Wallet Connection */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Seamless Wallet Connection</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Quick Connect</h3>
              <div className="space-x-2">
                <SeamlessWalletButton 
                  onSuccess={() => console.log('Wallet connected successfully!')}
                  onError={(error) => console.error('Connection failed:', error)}
                >
                  Connect Recommended Wallet
                </SeamlessWalletButton>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Connect Specific Wallet</h3>
              <div className="space-x-2">
                <SeamlessWalletButton 
                  walletName="phantom"
                  onSuccess={() => console.log('Phantom connected!')}
                  onError={(error) => console.error('Phantom connection failed:', error)}
                >
                  Connect Phantom
                </SeamlessWalletButton>
                <SeamlessWalletButton 
                  walletName="solflare"
                  onSuccess={() => console.log('Solflare connected!')}
                  onError={(error) => console.error('Solflare connection failed:', error)}
                >
                  Connect Solflare
                </SeamlessWalletButton>
                <SeamlessWalletButton 
                  walletName="backpack"
                  onSuccess={() => console.log('Backpack connected!')}
                  onError={(error) => console.error('Backpack connection failed:', error)}
                >
                  Connect Backpack
                </SeamlessWalletButton>
              </div>
            </div>

            <WalletConnectionStatus />
          </div>
        </div>

        {/* Wallet Availability Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Wallet Availability</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(connectionStates).map(([walletName, isAvailable]) => (
              <div 
                key={walletName}
                className={`p-3 rounded border ${
                  isAvailable 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{walletName}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    isAvailable 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {isAvailable ? 'Available' : 'Not Available'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Wallet Test Component */}
        <MobileWalletTest />

        {/* Additional Debug Information */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Environment Information</h2>
          <div className="space-y-2 text-sm">
            <p><strong>User Agent:</strong> {navigator.userAgent}</p>
            <p><strong>Platform:</strong> {navigator.platform}</p>
            <p><strong>Language:</strong> {navigator.language}</p>
            <p><strong>URL:</strong> {window.location.href}</p>
            <p><strong>Referrer:</strong> {document.referrer || 'None'}</p>
            <p><strong>Standalone:</strong> {(window.navigator as any).standalone ? 'Yes' : 'No'}</p>
            <p><strong>OnLine:</strong> {navigator.onLine ? 'Yes' : 'No'}</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-900">Testing Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-blue-800">
            <li>Use the "Seamless Wallet Connection" section for the best user experience</li>
            <li>Try "Connect Recommended Wallet" for automatic wallet selection</li>
            <li>Use specific wallet buttons to test individual wallet connections</li>
            <li>Monitor the "Wallet Availability" section to see which wallets are detected</li>
            <li>Use the "Mobile Wallet Test" section for detailed debugging</li>
            <li>Check the console for detailed debug information</li>
            <li>If redirects don't work, try installing the wallet app from the app store</li>
          </ol>
        </div>
      </div>
    </div>
  );
} 