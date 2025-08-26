import React, { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { PublicKey } from '@solana/web3.js';
import { debugChainInfo, validateSolanaConnection } from '../../utils/test-solana-chain';
import { getCurrentWallet, signTransactionWithWallet, getDebugInfo } from '../../utils/mobileWalletAdapter';

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
        const pubkey = new PublicKey(walletAddress);
        addLog(`PublicKey validation: ${pubkey.toString()}`);
        addLog(`Is on curve: ${PublicKey.isOnCurve(pubkey.toBytes())}`);
      } else {
        addLog('No wallet address available');
      }
    } catch (error) {
      addLog(`Error during address validation: ${error}`);
    }

    // Test 3: Current Wallet Detection
    addLog('=== Current Wallet Detection ===');
    try {
      const currentWallet = getCurrentWallet();
      addLog(`Current wallet detected: ${currentWallet || 'None'}`);
      
      // Check specific wallet availability
      addLog(`Phantom available: ${!!(window as any).phantom?.solana}`);
      addLog(`Solflare available: ${!!(window as any).solflare}`);
      addLog(`Backpack available: ${!!(window as any).backpack}`);
      addLog(`Generic solana available: ${!!(window as any).solana}`);
      
      // If Solflare is detected, test its methods
      if ((window as any).solflare) {
        addLog('=== Solflare Specific Tests ===');
        const solflare = (window as any).solflare;
        addLog(`Solflare isSolflare: ${solflare.isSolflare || 'undefined'}`);
        addLog(`Solflare connect method: ${typeof solflare.connect}`);
        addLog(`Solflare signAndSendTransaction method: ${typeof solflare.signAndSendTransaction}`);
        addLog(`Solflare signTransaction method: ${typeof solflare.signTransaction}`);
        addLog(`Solflare disconnect method: ${typeof solflare.disconnect}`);
      }
    } catch (error) {
      addLog(`Error during wallet detection: ${error}`);
    }

    // Test 4: Debug Info
    addLog('=== Environment Debug Info ===');
    try {
      const debugInfo = getDebugInfo();
      addLog(`Environment: ${JSON.stringify(debugInfo.environment, null, 2)}`);
      addLog(`Best wallet: ${debugInfo.bestWallet}`);
      addLog(`Window wallets: ${JSON.stringify(debugInfo.window, null, 2)}`);
    } catch (error) {
      addLog(`Error getting debug info: ${error}`);
    }

    // Test 5: Transaction Signing Test (if wallet is connected)
    if (isConnected && walletAddress) {
      addLog('=== Transaction Signing Test ===');
      try {
        // Create a simple test transaction
        const { Transaction, SystemProgram, PublicKey } = await import('@solana/web3.js');
        const testTransaction = new Transaction();
        
        // Add a simple transfer instruction (this won't actually execute)
        testTransaction.add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(walletAddress),
            toPubkey: new PublicKey(walletAddress), // Send to self for testing
            lamports: 0, // Zero amount for testing
          })
        );
        
        addLog('Test transaction created successfully');
        addLog(`Transaction instructions: ${testTransaction.instructions.length}`);
        
        // Try to sign the transaction
        const currentWallet = getCurrentWallet();
        if (currentWallet) {
          addLog(`Attempting to sign with ${currentWallet}...`);
          try {
            const signature = await signTransactionWithWallet(testTransaction, currentWallet);
            addLog(`✅ Transaction signed successfully: ${signature}`);
          } catch (signError) {
            addLog(`❌ Transaction signing failed: ${signError}`);
            addLog(`Error details: ${JSON.stringify(signError, null, 2)}`);
          }
        } else {
          addLog('No wallet detected for transaction signing test');
        }
      } catch (error) {
        addLog(`Error during transaction test: ${error}`);
      }
    }

    addLog('=== Test Complete ===');
  };

  const testSolflareTransaction = async () => {
    setLogs([]);
    addLog('=== Solflare Transaction Test ===');
    
    if (!(window as any).solflare) {
      addLog('❌ Solflare wallet not detected');
      return;
    }
    
    if (!isConnected || !walletAddress) {
      addLog('❌ Wallet not connected');
      return;
    }
    
    try {
      const solflare = (window as any).solflare;
      addLog(`✅ Solflare detected: ${solflare.isSolflare || 'isSolflare not set'}`);
      addLog(`✅ Wallet connected: ${walletAddress}`);
      
      // Test Solflare methods
      addLog('Testing Solflare methods...');
      addLog(`connect: ${typeof solflare.connect}`);
      addLog(`signAndSendTransaction: ${typeof solflare.signAndSendTransaction}`);
      addLog(`signTransaction: ${typeof solflare.signTransaction}`);
      addLog(`disconnect: ${typeof solflare.disconnect}`);
      
      // Create a test transaction
      const { Transaction, SystemProgram, PublicKey } = await import('@solana/web3.js');
      const testTransaction = new Transaction();
      
      // Add a simple transfer instruction (this won't actually execute)
      testTransaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(walletAddress),
          toPubkey: new PublicKey(walletAddress), // Send to self for testing
          lamports: 0, // Zero amount for testing
        })
      );
      
      addLog('✅ Test transaction created');
      
      // Try to sign with Solflare directly
      addLog('Attempting to sign transaction with Solflare...');
      try {
        const result = await solflare.signAndSendTransaction(testTransaction);
        const signature = result.signature || result;
        addLog(`✅ Solflare transaction signed successfully: ${signature}`);
      } catch (error) {
        addLog(`❌ Solflare transaction signing failed: ${error}`);
        addLog(`Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`);
        addLog(`Error message: ${error instanceof Error ? error.message : String(error)}`);
        addLog(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
        
        // Try alternative approach
        addLog('Trying alternative signing approach...');
        try {
          const signedTx = await solflare.signTransaction(testTransaction);
          addLog('✅ Transaction signed (but not sent)');
          addLog(`Signed transaction: ${signedTx.signatures.length} signatures`);
        } catch (signError) {
          addLog(`❌ Alternative signing also failed: ${signError instanceof Error ? signError.message : String(signError)}`);
        }
      }
      
    } catch (error) {
      addLog(`❌ Test failed: ${error}`);
    }
    
    addLog('=== Solflare Test Complete ===');
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
          <button
            onClick={testSolflareTransaction}
            className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
          >
            Solflare Transaction Test
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