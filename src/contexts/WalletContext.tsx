import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { Transaction, PublicKey } from '@solana/web3.js';
import type { Adapter } from '@solana/wallet-adapter-base';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { SOLANA_CONNECTION } from '../config/solana';
import '@solana/wallet-adapter-react-ui/styles.css';
import '../styles/wallet-modal.css';
import { supabase, AUTH_EXPIRED_EVENT } from '../lib/supabase';

// Import wallet adapters
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { LedgerWalletAdapter } from '@solana/wallet-adapter-ledger';
import { TorusWalletAdapter } from '@solana/wallet-adapter-torus';
import { WalletConnectWalletAdapter } from '@solana/wallet-adapter-walletconnect';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';

interface WalletNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: number;
}

// Define WalletNotFoundEvent interface for type safety
interface WalletNotFoundEvent extends Event {
  walletName?: string;
}

// Custom event creator for wallet not found events
const createWalletNotFoundEvent = (walletName: string): WalletNotFoundEvent => {
  const event = new Event('wallet-not-found') as WalletNotFoundEvent;
  event.walletName = walletName;
  return event;
};

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
  walletAuthToken: string | null;
  handleAuthExpiration: () => void;
  authenticate: (silent?: boolean) => Promise<string | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, connected, disconnect: nativeDisconnect, signMessage } = useSolanaWallet();
  const [error, setError] = useState<Error | null>(null);
  const [notifications, setNotifications] = useState<WalletNotification[]>([]);
  const [walletAuthToken, setWalletAuthToken] = useState<string | null>(null);
  // Add auth processing state to prevent multiple concurrent challenges
  const [isAuthInProgress, setIsAuthInProgress] = useState(false);
  // Track token's last verification time
  const [lastAuthTime, setLastAuthTime] = useState<number | null>(null);
  // Token expiration - 1 hour (in ms)
  const TOKEN_EXPIRATION = 60 * 60 * 1000;

  const addNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    // Prevent duplicate notifications (same type and message)
    // Check if we already have this exact notification
    const isDuplicate = notifications.some(n => 
      n.type === type && 
      n.message === message && 
      // Only consider recent notifications (within last 3 seconds) as duplicates
      Date.now() - n.timestamp < 3000
    );
    
    // Skip adding if it's a duplicate
    if (isDuplicate) {
      return;
    }
    
    const notification: WalletNotification = {
      id: crypto.randomUUID(),
      type,
      message,
      timestamp: Date.now()
    };
    setNotifications(prev => [...prev, notification]);
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      dismissNotification(notification.id);
    }, 3000);
  }, [notifications]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Function to create a secure authentication token
  const createAuthToken = useCallback(async (force = false) => {
    // Return existing token if it's not expired and not forcing refresh
    if (!force && walletAuthToken && lastAuthTime && (Date.now() - lastAuthTime < TOKEN_EXPIRATION)) {
      console.log('Using existing wallet auth token (not expired)');
      return walletAuthToken;
    }
    
    if (!publicKey || !signMessage) return null;
    
    // Prevent multiple concurrent auth challenges
    if (isAuthInProgress) {
      console.log('Authentication already in progress, skipping duplicate request');
      return walletAuthToken;
    }
    
    try {
      setIsAuthInProgress(true);
      
      // Create a friendly challenge message that clearly explains the purpose
      const timestamp = Date.now();
      const message = `buy merch. manage your orders.`;
      const encodedMessage = new TextEncoder().encode(message);
      
      // Ask user to sign the message - this proves ownership
      const signature = await signMessage(encodedMessage);
      
      // Create a custom session with Supabase that includes the wallet signature verification
      console.log('Calling create-wallet-auth function to obtain token...');
      const { data, error } = await supabase.functions.invoke('create-wallet-auth', {
        body: {
          wallet: publicKey.toString(),
          signature: Buffer.from(signature).toString('base64'),
          message,
          timestamp
        }
      });
      
      if (error) {
        console.error('Auth token creation error:', error);
        addNotification('error', 'Failed to authenticate wallet');
        return null;
      }
      
      // Store the JWT
      const token = data?.token;
      if (token) {
        console.log('Token received from server:', token.substring(0, 15) + '...');
        
        // Store token in state first to ensure it's available for API calls
        setWalletAuthToken(token);
        setLastAuthTime(Date.now());
        // Don't show a notification for successful auth to reduce notification spam
        
        return token;
      }
      
      // If we get here, we didn't get a token
      console.error('No token received from create-wallet-auth function');
      addNotification('error', 'Authentication failed - no token received');
      return null;
    } catch (error) {
      console.error('Error creating auth token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // User rejection messages are friendlier
      if (errorMessage.includes('cancelled') || errorMessage.includes('rejected') || errorMessage.includes('declined')) {
        addNotification('info', 'Authentication cancelled');
      } else {
        addNotification('error', `Authentication failed: ${errorMessage}`);
      }
      return null;
    } finally {
      setIsAuthInProgress(false);
    }
  }, [publicKey, signMessage, addNotification, walletAuthToken, lastAuthTime, isAuthInProgress]);

  // Listen for connection state changes and create auth token
  useEffect(() => {
    if (connected && publicKey) {
      // When wallet connects, immediately authenticate
      // We don't show a notification yet - we'll do that after auth attempt
      createAuthToken()
        .then(token => {
          if (token) {
            // Only show one notification for the whole process
            addNotification('success', 'Wallet connected and authenticated');
          } else {
            // If auth failed but wallet is connected, still show connection success
            addNotification('success', 'Wallet connected');
          }
        })
        .catch(error => {
          console.error('Auth error during connection:', error);
          // Still show connection success if auth fails
          addNotification('success', 'Wallet connected');
        });
    } else {
      // Clear auth token when wallet disconnects
      setWalletAuthToken(null);
      setLastAuthTime(null);
    }
  }, [connected, publicKey, addNotification, createAuthToken]);

  // Handler for expired auth tokens
  const handleAuthExpiration = useCallback(() => {
    // Check if the token is actually expired based on our local tracking
    if (lastAuthTime && (Date.now() - lastAuthTime < TOKEN_EXPIRATION)) {
      console.log('Auth token not expired based on local tracking, skipping refresh');
      return;
    }
    
    // Clear existing token
    setWalletAuthToken(null);
    
    // Only show a minimal notification
    addNotification('info', 'Please reconnect your wallet');
    
    // Don't auto-retry authentication - let the user decide when to authenticate
  }, [lastAuthTime, addNotification]);

  // Listen for auth expiration events
  useEffect(() => {
    const handleAuthExpiredEvent = () => {
      handleAuthExpiration();
    };
    
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpiredEvent);
    
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpiredEvent);
    };
  }, [handleAuthExpiration]);

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
      
      // Clear auth token and state before disconnecting
      setWalletAuthToken(null);
      setLastAuthTime(null);
      setIsAuthInProgress(false);
      
      // Clear Supabase session
      await supabase.auth.signOut();
      
      // Disconnect wallet after cleanup
      await nativeDisconnect();
      
      addNotification('info', 'Wallet disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect wallet';
      setError(error instanceof Error ? error : new Error(errorMessage));
      addNotification('error', 'Failed to disconnect');
    }
  }, [nativeDisconnect, addNotification]);

  const signAndSendTransaction = useCallback(async (transaction: Transaction): Promise<string> => {
    if (!connected || !publicKey || !window.solana) {
      throw new Error('Wallet not connected');
    }

    try {
      setError(null);

      // Get fresh blockhash
      const { blockhash } = await SOLANA_CONNECTION.getLatestBlockhash();
      
      // Update transaction
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign and send transaction atomically
      const { signature } = await window.solana.signAndSendTransaction(transaction);
      addNotification('success', `Transaction sent: ${signature.slice(0, 8)}...`);

      return signature;
    } catch (error) {
      console.error('Transaction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      setError(error instanceof Error ? error : new Error(errorMessage));
      addNotification('error', errorMessage);
      throw error;
    }
  }, [connected, publicKey, addNotification]);

  // Make authenticate function available for explicit re-authentication if needed
  const authenticate = useCallback(async (silent = false) => {
    if (!connected || !publicKey) {
      if (!silent) {
        addNotification('error', 'Wallet must be connected first');
      }
      return null;
    }
    
    const token = await createAuthToken();
    if (token && !silent) {
      // Only show a success message if explicitly re-authenticated
      addNotification('success', 'Wallet authenticated');
    }
    return token;
  }, [createAuthToken, connected, publicKey, addNotification]);

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
      dismissNotification,
      walletAuthToken,
      handleAuthExpiration,
      authenticate
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
    // Function to handle redirection to wallet websites or mobile apps
    const handleWalletNotFound = (event: WalletNotFoundEvent) => {
      const walletName = event.walletName;
      
      if (walletName === 'phantom') {
        // Mobile detection with comprehensive device support
        const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          // iOS detection
          const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
          
          // App store links
          const appStoreLink = isIOS 
            ? 'https://apps.apple.com/us/app/phantom-solana-wallet/id1598432977'  // iOS App Store
            : 'https://play.google.com/store/apps/details?id=app.phantom'; // Google Play
          
          // Universal link for Phantom with the correct format
          const appUrl = encodeURIComponent(window.location.href);
          const universalLink = `https://phantom.app/ul/browse/${appUrl}`;
          const alternativeLink = `phantom://browse?url=${appUrl}`;
          
          // Track if we've redirected
          let hasRedirected = false;
          
          // Set timeout for fallback to app store
          const appStoreTimeout = setTimeout(() => {
            if (!hasRedirected) {
              hasRedirected = true;
              window.location.href = appStoreLink;
            }
          }, 2500); // Extended timeout for slower devices
          
          // Before navigating away, clear the timeout
          window.addEventListener('beforeunload', () => {
            clearTimeout(appStoreTimeout);
          });
          
          // Try universal link first
          try {
            window.location.href = universalLink;
            
            // Set a secondary timeout for the alternative method
            setTimeout(() => {
              if (!hasRedirected) {
                try {
                  window.location.href = alternativeLink;
                } catch (e) {
                  // If there's an error with the alternative link, 
                  // the app store fallback will still trigger
                }
              }
            }, 1000);
          } catch (e) {
            // If there's an error with the universal link, try the alternative immediately
            try {
              window.location.href = alternativeLink;
            } catch (innerError) {
              // If both fail, the app store fallback will still trigger
            }
          }
        } else {
          // Desktop - open website in new tab (more reliable than same window)
          const newWindow = window.open('https://phantom.com/', '_blank');
          // Ensure the window opened successfully
          if (newWindow) {
            newWindow.focus();
          } else {
            // If popup blocked, try to open in same window as fallback
            window.location.href = 'https://phantom.com/';
          }
        }
      }
      // Add more wallets if needed in future
    };

    // Add the event listener
    window.addEventListener('wallet-not-found', handleWalletNotFound as EventListener);

    // This is a more reliable way to intercept the wallet adapter button clicks
    const interceptPhantomButtonClicks = (e: MouseEvent) => {
      // Find if the click was on a Phantom button or its child elements
      const path = e.composedPath();
      let phantomButton = null;
      
      for (const element of path) {
        if (
          element instanceof HTMLElement && 
          (
            (element.classList.contains('wallet-adapter-button') && element.getAttribute('data-id') === 'phantom') ||
            element.classList.contains('wallet-adapter-button-phantom')
          )
        ) {
          phantomButton = element;
          break;
        }
      }
      
      // If we found a phantom button and the wallet is not installed
      if (phantomButton && !window.phantom?.solana) {
        // Prevent default action
        e.preventDefault();
        e.stopPropagation();
        
        // Dispatch custom event
        const walletNotFoundEvent = createWalletNotFoundEvent('phantom');
        window.dispatchEvent(walletNotFoundEvent);
        
        return false;
      }
    };

    // Add a global click handler (more reliable than trying to find buttons)
    document.addEventListener('click', interceptPhantomButtonClicks, true);

    return () => {
      window.removeEventListener('wallet-not-found', handleWalletNotFound as EventListener);
      document.removeEventListener('click', interceptPhantomButtonClicks, true);
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