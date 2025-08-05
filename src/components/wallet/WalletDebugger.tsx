import React, { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { PublicKey } from '@solana/web3.js';
import { debugChainInfo, validateSolanaConnection } from '../../utils/test-solana-chain';

export function WalletDebugger() {
  const { 
    isConnected, 
    walletAddress, 
    connect, 
    disconnect, 
    toggleConnect,
    forceDisconnect,
    ready, 
    authenticated, 
    user,
    login,
    logout 
  } = useWallet();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const runComprehensiveTest = async () => {
    setLogs([]);
    addLog('Starting comprehensive Privy wallet debug test...');

    // Test 1: Solana Chain Validation
    addLog('=== Solana Chain Validation ===');
    try {
      if (user) {
        const validation = validateSolanaConnection(user);
        addLog(`Chain ID: ${validation.chainId || 'None'}`);
        addLog(`Chain Type: ${validation.chainType || 'None'}`);
        addLog(`Validation: ${validation.message}`);
        addLog(`Is Valid: ${validation.isValid ? 'Yes' : 'No'}`);
      } else {
        addLog('No user object available');
      }
    } catch (error) {
      addLog(`Error during chain validation: ${error}`);
    }

    // Test 2: Wallet Address Validation
    addLog('=== Wallet Address Validation ===');
    try {
      if (walletAddress) {
        addLog(`Wallet address: ${walletAddress}`);
        addLog(`Address length: ${walletAddress.length}`);
        addLog(`Base58 format check: ${/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)}`);
        
        try {
          const testKey = new PublicKey(walletAddress);
          addLog(`✅ PublicKey creation successful: ${testKey.toBase58()}`);
        } catch (error) {
          addLog(`❌ PublicKey creation failed: ${error}`);
          addLog('This indicates a base58 format error - likely an Ethereum address instead of Solana');
        }
      } else {
        addLog('No wallet address available');
      }
    } catch (error) {
      addLog(`Error during address validation: ${error}`);
    }

    // Test 3: Privy User Object
    addLog('=== Privy User Object ===');
    try {
      if (user) {
        addLog(`User authenticated: ${authenticated}`);
        addLog(`User ready: ${ready}`);
        addLog(`User wallet address: ${user.wallet?.address || 'No address'}`);
        addLog(`User wallet chainId: ${user.wallet?.chainId || 'No chainId'}`);
        addLog(`User wallet chainType: ${user.wallet?.chainType || 'No chainType'}`);
        addLog(`User wallet clientType: ${user.wallet?.walletClientType || 'No clientType'}`);
      } else {
        addLog('No user object available');
      }
    } catch (error) {
      addLog(`Error during user object inspection: ${error}`);
    }

    // Test 4: Environment Detection
    addLog('=== Environment Detection ===');
    addLog(`User Agent: ${navigator.userAgent}`);
    addLog(`Location: ${window.location.href}`);
    addLog(`Referrer: ${document.referrer || 'None'}`);
    addLog(`Platform: ${navigator.platform}`);
    addLog(`Language: ${navigator.language}`);

    // Test 5: Privy Status
    addLog('=== Privy Status ===');
    addLog(`Ready: ${ready}`);
    addLog(`Authenticated: ${authenticated}`);
    addLog(`Connected: ${isConnected}`);
    addLog(`Wallet Address: ${walletAddress || 'None'}`);

    // Test 6: User Object Analysis
    addLog('=== User Object Analysis ===');
    if (user) {
      addLog(`User ID: ${user.id || 'None'}`);
      addLog(`User Type: ${user.type || 'None'}`);
      addLog(`Linked Accounts: ${user.linkedAccounts?.length || 0}`);
      
      if (user.linkedAccounts) {
        user.linkedAccounts.forEach((account: any, index: number) => {
          addLog(`  Account ${index + 1}: ${account.type} - ${account.address || 'No address'}`);
        });
      }
      
      if (user.wallet) {
        addLog(`Wallet Type: ${user.wallet.type || 'None'}`);
        addLog(`Wallet Address: ${user.wallet.address || 'None'}`);
        addLog(`Wallet Chain: ${user.wallet.chainId || 'None'}`);
      }
    } else {
      addLog('No user object available');
    }

    // Test 7: Window Object Analysis
    addLog('=== Window Object Analysis ===');
    const windowKeys = Object.keys(window).filter(key => 
      key.toLowerCase().includes('phantom') || 
      key.toLowerCase().includes('solana') || 
      key.toLowerCase().includes('solflare') || 
      key.toLowerCase().includes('backpack') ||
      key.toLowerCase().includes('privy')
    );
    addLog(`Relevant window keys: ${windowKeys.join(', ')}`);

    // Test 8: Deep Object Inspection
    addLog('=== Deep Object Inspection ===');
    try {
      if ((window as any).phantom) {
        addLog('window.phantom exists');
        addLog(`window.phantom.solana: ${!!(window as any).phantom?.solana}`);
        addLog(`window.phantom.isPhantom: ${!!(window as any).phantom?.isPhantom}`);
      } else {
        addLog('window.phantom does not exist');
      }

      if ((window as any).solana) {
        addLog('window.solana exists');
        addLog(`window.solana.isPhantom: ${!!(window as any).solana?.isPhantom}`);
        addLog(`window.solana.isSolflare: ${!!(window as any).solana?.isSolflare}`);
        addLog(`window.solana.isBackpack: ${!!(window as any).solana?.isBackpack}`);
      } else {
        addLog('window.solana does not exist');
      }

      if ((window as any).privy) {
        addLog('window.privy exists');
        addLog(`window.privy: ${typeof (window as any).privy}`);
      } else {
        addLog('window.privy does not exist');
      }
    } catch (error) {
      addLog(`Error during deep inspection: ${error}`);
    }

    // Test 9: Connection Test
    addLog('=== Connection Test ===');
    if (isConnected) {
      addLog('Wallet is connected');
      addLog(`Connected Address: ${walletAddress}`);
    } else {
      addLog('Wallet is not connected');
    }

    addLog('=== Test Complete ===');
  };

  const testWalletConnection = async () => {
    addLog('Testing wallet connection toggle...');
    try {
      await toggleConnect();
      addLog(`Wallet ${isConnected ? 'disconnected' : 'connected'} successfully`);
    } catch (error) {
      addLog(`Wallet connection error: ${error}`);
    }
  };

  const testPrivyLogin = async () => {
    addLog('Testing Privy login...');
    try {
      await login();
      addLog('Privy login initiated');
    } catch (error) {
      addLog(`Privy login error: ${error}`);
    }
  };

  const testPrivyLogout = async () => {
    addLog('Testing Privy logout...');
    try {
      await logout();
      addLog('Privy logout initiated');
    } catch (error) {
      addLog(`Privy logout error: ${error}`);
    }
  };

  const testForceDisconnect = async () => {
    addLog('Testing force disconnect...');
    try {
      await forceDisconnect();
      addLog('Force disconnect completed');
    } catch (error) {
      addLog(`Force disconnect error: ${error}`);
    }
  };

  const testChainValidation = () => {
    addLog('Testing Solana chain validation...');
    try {
      debugChainInfo(user);
      addLog('Chain validation test completed - check console for details');
    } catch (error) {
      addLog(`Chain validation test error: ${error}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Privy Wallet Debugger</h3>
        <div className="space-x-2">
          <button
            onClick={runComprehensiveTest}
            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
          >
            Run Full Test
          </button>
          <button
            onClick={clearLogs}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            Clear Logs
          </button>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-bold mb-2">Quick Tests:</h4>
        <div className="space-x-2">
          <button
            onClick={testWalletConnection}
            className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
          >
            {isConnected ? 'Disconnect' : 'Connect'} Wallet
          </button>
          <button
            onClick={testPrivyLogin}
            className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700"
          >
            Privy Login
          </button>
          <button
            onClick={testPrivyLogout}
            className="bg-orange-600 text-white px-2 py-1 rounded text-xs hover:bg-orange-700"
          >
            Privy Logout
          </button>
          <button
            onClick={testForceDisconnect}
            className="bg-yellow-600 text-white px-2 py-1 rounded text-xs hover:bg-yellow-700"
          >
            Force Disconnect
          </button>
          <button
            onClick={testChainValidation}
            className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700"
          >
            Test Chain
          </button>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-bold mb-2">Current State:</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>Ready: {ready ? 'Yes' : 'No'}</div>
          <div>Authenticated: {authenticated ? 'Yes' : 'No'}</div>
          <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
          <div>Address: {walletAddress ? `${walletAddress.substring(0, 8)}...` : 'None'}</div>
          <div>User Type: {user?.type || 'None'}</div>
          <div>Linked Accounts: {user?.linkedAccounts?.length || 0}</div>
        </div>
      </div>

      <div className="bg-black p-3 rounded max-h-96 overflow-y-auto">
        <h4 className="font-bold mb-2">Debug Logs:</h4>
        {logs.length === 0 ? (
          <div className="text-gray-500">No logs yet. Run a test to see debug information.</div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="text-xs">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 