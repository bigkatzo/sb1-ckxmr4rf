import React, { useState, useEffect } from 'react';
import { 
  isTWA, 
  isMobile, 
  detectWallets, 
  getBestWallet, 
  connectToWallet,
  getDebugInfo 
} from '../../utils/mobileWalletAdapter';
import { useWallet } from '../../contexts/WalletContext';

export function MobileWalletTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [wallets, setWallets] = useState<Record<string, any>>({});
  const [environment, setEnvironment] = useState<any>({});
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const { isConnected, walletAddress, connect, disconnect, toggleConnect } = useWallet();

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testEnvironment = () => {
    addLog('=== Environment Test ===');
    const isTWAEnv = isTWA();
    const isMobileEnv = isMobile();
    
    setEnvironment({
      isTWA: isTWAEnv,
      isMobile: isMobileEnv,
      userAgent: navigator.userAgent,
      displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      platform: navigator.platform,
      hasTrustedTypes: 'trustedTypes' in window,
      hasAndroid: (window as any).Android !== undefined,
    });
    
    addLog(`TWA Environment: ${isTWAEnv}`);
    addLog(`Mobile Environment: ${isMobileEnv}`);
    addLog(`User Agent: ${navigator.userAgent}`);
    addLog(`Display Mode: ${window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'}`);
    addLog(`Window Size: ${window.innerWidth}x${window.innerHeight}`);
    addLog(`Platform: ${navigator.platform}`);
    addLog(`Has TrustedTypes: ${'trustedTypes' in window}`);
    addLog(`Has Android: ${(window as any).Android !== undefined}`);
  };

  const testWalletDetection = () => {
    addLog('=== Wallet Detection Test ===');
    const detectedWallets = detectWallets();
    setWallets(detectedWallets);
    
    Object.entries(detectedWallets).forEach(([name, wallet]) => {
      addLog(`${name}: Available=${wallet.isAvailable}, CanConnect=${wallet.canConnect}`);
    });
    
    const bestWallet = getBestWallet();
    addLog(`Best Wallet: ${bestWallet || 'None'}`);
  };

  const testWalletConnection = async (walletName: string) => {
    addLog(`=== Testing ${walletName} Connection ===`);
    try {
      const success = await connectToWallet(walletName);
      addLog(`${walletName} connection: ${success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      addLog(`${walletName} connection error: ${error}`);
    }
  };

  const testPrivyConnection = async () => {
    addLog('=== Testing Privy Connection ===');
    try {
      await connect();
      addLog('Privy connection attempt completed');
    } catch (error) {
      addLog(`Privy connection error: ${error}`);
    }
  };

  const getFullDebugInfo = () => {
    addLog('=== Getting Full Debug Info ===');
    const info = getDebugInfo();
    setDebugInfo(info);
    addLog('Debug info captured, check the debug panel below');
  };

  const retryDetection = () => {
    addLog('=== Retrying Wallet Detection ===');
    testWalletDetection();
  };

  // Auto-run tests on mount
  useEffect(() => {
    testEnvironment();
    testWalletDetection();
    getFullDebugInfo();
  }, []);

  return (
    <div className="p-4 bg-gray-900 text-white rounded-lg max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Mobile Wallet Test</h2>
      
      {/* Environment Info */}
      <div className="mb-4 p-3 bg-gray-800 rounded">
        <h3 className="font-semibold mb-2">Environment</h3>
        <div className="text-sm space-y-1">
          <div>TWA: {environment.isTWA ? '✅ Yes' : '❌ No'}</div>
          <div>Mobile: {environment.isMobile ? '✅ Yes' : '❌ No'}</div>
          <div>Display Mode: {environment.displayMode}</div>
          <div>Window Size: {environment.windowSize}</div>
          <div>Platform: {environment.platform}</div>
          <div>Has TrustedTypes: {environment.hasTrustedTypes ? '✅ Yes' : '❌ No'}</div>
          <div>Has Android: {environment.hasAndroid ? '✅ Yes' : '❌ No'}</div>
        </div>
      </div>

      {/* Wallet Status */}
      <div className="mb-4 p-3 bg-gray-800 rounded">
        <h3 className="font-semibold mb-2">Wallet Status</h3>
        <div className="text-sm space-y-1">
          <div>Connected: {isConnected ? '✅ Yes' : '❌ No'}</div>
          <div>Address: {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : 'None'}</div>
        </div>
      </div>

      {/* Detected Wallets */}
      <div className="mb-4 p-3 bg-gray-800 rounded">
        <h3 className="font-semibold mb-2">Detected Wallets</h3>
        <div className="text-sm space-y-1">
          {Object.entries(wallets).map(([name, wallet]) => (
            <div key={name} className="flex justify-between">
              <span className="capitalize">{name}:</span>
              <span>
                {wallet.isAvailable ? '✅' : '❌'} Available
                {wallet.canConnect ? ' ✅' : ' ❌'} Can Connect
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Test Buttons */}
      <div className="mb-4 p-3 bg-gray-800 rounded">
        <h3 className="font-semibold mb-2">Test Actions</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={testEnvironment}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Test Environment
          </button>
          <button
            onClick={testWalletDetection}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
          >
            Test Wallet Detection
          </button>
          <button
            onClick={retryDetection}
            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
          >
            Retry Detection
          </button>
          <button
            onClick={testPrivyConnection}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
          >
            Test Privy Connection
          </button>
          <button
            onClick={getFullDebugInfo}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
          >
            Get Debug Info
          </button>
          <button
            onClick={clearLogs}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Clear Logs
          </button>
        </div>
      </div>

      {/* Individual Wallet Test Buttons */}
      <div className="mb-4 p-3 bg-gray-800 rounded">
        <h3 className="font-semibold mb-2">Test Individual Wallets</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => testWalletConnection('phantom')}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
          >
            Test Phantom
          </button>
          <button
            onClick={() => testWalletConnection('solflare')}
            className="px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-sm"
          >
            Test Solflare
          </button>
          <button
            onClick={() => testWalletConnection('backpack')}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Test Backpack
          </button>
        </div>
      </div>

      {/* Debug Info Panel */}
      {debugInfo && (
        <div className="mb-4 p-3 bg-gray-800 rounded">
          <h3 className="font-semibold mb-2">Debug Info</h3>
          <details className="text-sm">
            <summary className="cursor-pointer">Click to expand debug info</summary>
            <pre className="mt-2 text-xs overflow-auto max-h-40">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {/* Logs */}
      <div className="mb-4 p-3 bg-gray-800 rounded">
        <h3 className="font-semibold mb-2">Logs</h3>
        <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
          {logs.map((log, index) => (
            <div key={index} className="font-mono">{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
} 