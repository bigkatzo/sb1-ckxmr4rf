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
    });
    
    addLog(`TWA Environment: ${isTWAEnv}`);
    addLog(`Mobile Environment: ${isMobileEnv}`);
    addLog(`User Agent: ${navigator.userAgent}`);
    addLog(`Display Mode: ${window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'}`);
    addLog(`Window Size: ${window.innerWidth}x${window.innerHeight}`);
    addLog(`Platform: ${navigator.platform}`);
  };

  const testWalletDetection = () => {
    addLog('=== Wallet Detection Test ===');
    const detectedWallets = detectWallets();
    setWallets(detectedWallets);
    
    Object.entries(detectedWallets).forEach(([name, wallet]) => {
      addLog(`${name}: Available=${wallet.isAvailable}, Installed=${wallet.isInstalled}, CanConnect=${wallet.canConnect}`);
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
      if (isConnected) {
        await disconnect();
        addLog('Disconnected from Privy');
      } else {
        await connect();
        addLog('Connected to Privy');
      }
    } catch (error) {
      addLog(`Privy connection error: ${error}`);
    }
  };

  const testToggleConnection = async () => {
    addLog('=== Testing Toggle Connection ===');
    try {
      await toggleConnect();
      addLog(`Connection toggled: ${isConnected ? 'disconnected' : 'connected'}`);
    } catch (error) {
      addLog(`Toggle connection error: ${error}`);
    }
  };

  const getDebugInformation = () => {
    addLog('=== Debug Information ===');
    const debugInfo = getDebugInfo();
    if (debugInfo) {
      addLog(`Config: ${JSON.stringify(debugInfo.config)}`);
      addLog(`Environment: ${JSON.stringify(debugInfo.environment)}`);
      addLog(`Wallets: ${JSON.stringify(debugInfo.wallets)}`);
      addLog(`Best Wallet: ${debugInfo.bestWallet}`);
    } else {
      addLog('No debug information available');
    }
  };

  const testDeepLinks = () => {
    addLog('=== Testing Deep Links ===');
    const deepLinks = {
      phantom: 'https://phantom.app/ul/browse/',
      solflare: 'https://solflare.com/',
      backpack: 'https://backpack.app/',
    };
    
    Object.entries(deepLinks).forEach(([wallet, url]) => {
      addLog(`${wallet}: ${url}`);
    });
  };

  const runComprehensiveTest = async () => {
    addLog('=== Starting Comprehensive Test ===');
    
    // Test environment
    testEnvironment();
    
    // Test wallet detection
    testWalletDetection();
    
    // Test debug info
    getDebugInformation();
    
    // Test deep links
    testDeepLinks();
    
    // Test Privy connection
    await testPrivyConnection();
    
    addLog('=== Comprehensive Test Complete ===');
  };

  // Auto-run environment test on mount
  useEffect(() => {
    testEnvironment();
    testWalletDetection();
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
      <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <button
          onClick={testEnvironment}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
        >
          Test Environment
        </button>
        <button
          onClick={testWalletDetection}
          className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
        >
          Detect Wallets
        </button>
        <button
          onClick={testPrivyConnection}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm"
        >
          Test Privy
        </button>
        <button
          onClick={testToggleConnection}
          className="px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded text-sm"
        >
          Toggle Connect
        </button>
        <button
          onClick={getDebugInformation}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm"
        >
          Debug Info
        </button>
        <button
          onClick={testDeepLinks}
          className="px-3 py-2 bg-teal-600 hover:bg-teal-700 rounded text-sm"
        >
          Test Deep Links
        </button>
        <button
          onClick={runComprehensiveTest}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
        >
          Full Test
        </button>
        <button
          onClick={clearLogs}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm"
        >
          Clear Logs
        </button>
      </div>

      {/* Individual Wallet Test Buttons */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">Test Individual Wallets</h3>
        <div className="flex gap-2 flex-wrap">
          {Object.keys(wallets).map(walletName => (
            <button
              key={walletName}
              onClick={() => testWalletConnection(walletName)}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
            >
              Test {walletName}
            </button>
          ))}
        </div>
      </div>

      {/* Logs */}
      <div className="bg-black p-3 rounded font-mono text-xs max-h-96 overflow-y-auto">
        <h3 className="font-semibold mb-2">Logs</h3>
        {logs.length === 0 ? (
          <div className="text-gray-500">No logs yet. Run a test to see results.</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
} 