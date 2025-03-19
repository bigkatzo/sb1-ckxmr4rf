import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { Transaction, PublicKey } from '@solana/web3.js';
import type { Adapter } from '@solana/wallet-adapter-base';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { SOLANA_CONNECTION } from '../config/solana';
import '@solana/wallet-adapter-react-ui/styles.css';
import '../styles/wallet-modal.css';

// Import wallet adapters
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { LedgerWalletAdapter } from '@solana/wallet-adapter-ledger';
import { TorusWalletAdapter } from '@solana/wallet-adapter-torus';
import { WalletConnectWalletAdapter } from '@solana/wallet-adapter-walletconnect';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';

interface WalletNotification {
  id: string;
  type: 'success' | 'error';
  message: string;
  timestamp: number;
}

interface WalletContextType {
  isConnected: boolean;
  walletAddress: string | null;
  publicKey: PublicKey | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSendTransaction: (transaction: Transaction) => Promise<string>;
  error: Error | null;
  notifications: WalletNotification[];
  dismissNotification: (id: string) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, connected, disconnect: nativeDisconnect, signTransaction, sendTransaction } = useSolanaWallet();
  const [error, setError] = useState<Error | null>(null);
  const [notifications, setNotifications] = useState<WalletNotification[]>([]);

  const addNotification = useCallback((type: 'success' | 'error', message: string) => {
    const notification: WalletNotification = {
      id: crypto.randomUUID(),
      type,
      message,
      timestamp: Date.now()
    };
    setNotifications(prev => [...prev, notification]);
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      dismissNotification(notification.id);
    }, 5000);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Listen for connection state changes
  useEffect(() => {
    if (connected && publicKey) {
      addNotification('success', 'Wallet connected!');
    }
  }, [connected, publicKey, addNotification]);

  const connect = useCallback(async () => {
    try {
      setError(null);
      // Connection is handled by the wallet modal
    } catch (error) {
      console.error('Connect error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      setError(error instanceof Error ? error : new Error(errorMessage));
      addNotification('error', 'Failed to connect wallet');
      throw error;
    }
  }, [addNotification]);

  const disconnect = useCallback(async () => {
    try {
      setError(null);
      await nativeDisconnect();
      addNotification('success', 'Wallet disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect wallet';
      setError(error instanceof Error ? error : new Error(errorMessage));
      addNotification('error', 'Failed to disconnect');
    }
  }, [nativeDisconnect, addNotification]);

  const signAndSendTransaction = useCallback(async (transaction: Transaction): Promise<string> => {
    if (!connected || !publicKey || !signTransaction || !sendTransaction) {
      throw new Error('Wallet not connected');
    }

    try {
      setError(null);

      // Get fresh blockhash
      const { blockhash } = await SOLANA_CONNECTION.getLatestBlockhash();
      
      // Update transaction
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign transaction
      const signedTransaction = await signTransaction(transaction);
      
      // Send transaction
      const signature = await sendTransaction(signedTransaction, SOLANA_CONNECTION);
      addNotification('success', `Transaction sent: ${signature.slice(0, 8)}...`);

      return signature;
    } catch (error) {
      console.error('Transaction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      setError(error instanceof Error ? error : new Error(errorMessage));
      addNotification('error', errorMessage);
      throw error;
    }
  }, [connected, publicKey, signTransaction, sendTransaction, addNotification]);

  return (
    <WalletContext.Provider value={{
      isConnected: connected,
      walletAddress: publicKey?.toBase58() || null,
      publicKey,
      connect,
      disconnect,
      signAndSendTransaction,
      error,
      notifications,
      dismissNotification
    }}>
      {children}
    </WalletContext.Provider>
  );
}

// Add custom error event to detect wallet not found
interface WalletNotFoundEvent extends Event {
  walletName?: string;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Initialize wallet adapters
  const [wallets, setWallets] = useState<Adapter[]>([]);
  
  // Add listener to handle wallet not found events
  useEffect(() => {
    // Function to handle redirection to wallet websites
    const handleWalletNotFound = (event: WalletNotFoundEvent) => {
      const walletName = event.walletName;
      
      if (walletName === 'phantom') {
        window.open('https://phantom.com/', '_blank');
      }
      // Add more wallets if needed in future
    };

    // Add the event listener
    window.addEventListener('wallet-not-found', handleWalletNotFound as EventListener);

    // If using the Phantom adapter, listen for clicks and check if Phantom exists
    const checkForPhantomWallet = () => {
      const phantomButtons = document.querySelectorAll('.wallet-adapter-button[data-id="phantom"]');
      phantomButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          if (!window.phantom?.solana) {
            e.preventDefault();
            e.stopPropagation();
            
            // Dispatch custom event
            const walletNotFoundEvent = new Event('wallet-not-found') as WalletNotFoundEvent;
            walletNotFoundEvent.walletName = 'phantom';
            window.dispatchEvent(walletNotFoundEvent);
            
            return false;
          }
        });
      });
    };

    // Add a mutation observer to detect when wallet buttons are added to the DOM
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          setTimeout(checkForPhantomWallet, 100);
        }
      }
    });

    // Start observing the document body for added nodes
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check
    setTimeout(checkForPhantomWallet, 1000);

    return () => {
      window.removeEventListener('wallet-not-found', handleWalletNotFound as EventListener);
      observer.disconnect();
    };
  }, []);
  
  useEffect(() => {
    async function loadWallets() {
      // Initialize adapters for non-standard wallets
      const adapters = [
        // Phantom - Add it first to show at the top
        new PhantomWalletAdapter(),
        
        // Solflare - Still needed as a direct adapter
        new SolflareWalletAdapter(),
        
        // Backpack - Popular but not yet standard-compliant
        new BackpackWalletAdapter(),
        
        // Hardware wallet support
        new LedgerWalletAdapter(),
        
        // Social login support (optional)
        new TorusWalletAdapter(),
        
        // WalletConnect support for mobile (optional)
        new WalletConnectWalletAdapter({
          network: WalletAdapterNetwork.Mainnet,
          options: {
            projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
            metadata: {
              name: 'StoreDotFun',
              description: 'StoreDotFun - Web3 Merch Store',
              url: window.location.origin,
              icons: [`${window.location.origin}/logo.png`]
            }
          }
        })
      ].filter(Boolean);

      setWallets(adapters);
    }
    loadWallets();
  }, []);

  if (wallets.length === 0) {
    return <div>Loading wallets...</div>;
  }

  return (
    <ConnectionProvider endpoint={SOLANA_CONNECTION.rpcEndpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletContextProvider>
            {children}
          </WalletContextProvider>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}