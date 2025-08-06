import React from 'react';
import { MobileWalletTest } from '../components/wallet/MobileWalletTest';
import { WalletDebugger } from '../components/wallet/WalletDebugger';
import { ConnectionDebugger } from '../components/wallet/ConnectionDebugger';

export function WalletTestPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">Wallet Connection Test</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Mobile Wallet Test */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Mobile Wallet Test</h2>
            <MobileWalletTest />
          </div>
          
          {/* Connection Debugger */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Connection Debugger</h2>
            <ConnectionDebugger />
          </div>
          
          {/* Wallet Debugger */}
          <div>
            <h2 className="text-2xl font-semibold mb-4">Wallet Debugger</h2>
            <WalletDebugger />
          </div>
        </div>
        
        {/* Instructions */}
        <div className="mt-8 p-6 bg-gray-800 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">Testing Instructions</h3>
          <div className="space-y-2 text-sm">
            <p><strong>1. MetaMask Prompt Issue:</strong> Use the Mobile Wallet Test to check if MetaMask is being detected when it shouldn't be.</p>
            <p><strong>2. Mobile Device Testing:</strong> Test on your mobile device or TWA to see if wallets are properly detected.</p>
            <p><strong>3. Connection Error:</strong> Use the Connection Debugger to see the connection flow and identify where the "please connect solana..." error occurs.</p>
            <p><strong>4. Environment Detection:</strong> Check if TWA and mobile environments are properly detected.</p>
            <p><strong>5. Error Notification Issue:</strong> The Connection Debugger will show you exactly when and why error notifications are being triggered.</p>
          </div>
        </div>
      </div>
    </div>
  );
} 