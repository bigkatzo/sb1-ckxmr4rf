import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { Transaction, PublicKey } from '@solana/web3.js';
import type { Adapter } from '@solana/wallet-adapter-base';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { SOLANA_CONNECTION } from '../config/solana';
import '@solana/wallet-adapter-react-ui/styles.css';
import '../styles/wallet-modal.css';
import { supabase } from '../lib/supabase';
import { mobileWalletAdapter } from '../services/mobileWalletAdapter';

// Import wallet adapters
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { LedgerWalletAdapter } from '@solana/wallet-adapter-ledger';
import { TorusWalletAdapter } from '@solana/wallet-adapter-torus';
import { WalletConnectWalletAdapter } from '@solana/wallet-adapter-walletconnect';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';

// Custom event for auth expiration
export const AUTH_EXPIRED_EVENT = 'wallet-auth-expired';

// Time after which we should refresh the token (45 minutes)
const TOKEN_REFRESH_TIME = 45 * 60 * 1000;

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
  ensureAuthenticated: () => Promise<boolean>;
  isAuthenticating: boolean;
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
  
  // Try to recover token from sessionStorage on mount
  useEffect(() => {
    try {
      const storedToken = sessionStorage.getItem('walletAuthToken');
      const storedAuthTime = sessionStorage.getItem('walletAuthTime');
      
      if (storedToken && storedAuthTime) {
        const authTime = parseInt(storedAuthTime, 10);
        // Only restore if token isn't too old
        if (Date.now() - authTime < TOKEN_REFRESH_TIME) {
          setWalletAuthToken(storedToken);
          setLastAuthTime(authTime);
        } else {
          // Clear expired token
          sessionStorage.removeItem('walletAuthToken');
          sessionStorage.removeItem('walletAuthTime');
        }
      }
    } catch (e) {
      console.error('Error restoring auth token:', e);
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    // Remove any existing notifications with the same message
    setNotifications(prev => prev.filter(n => n.message !== message));
    
    // Create new notification
    const id = crypto.randomUUID();
    const notification: WalletNotification = {
      id,
      type,
      message,
      timestamp: Date.now()
    };
    
    // Add to state
    setNotifications(prev => [...prev, notification]);
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      dismissNotification(id);
    }, 3000);
  }, [dismissNotification]);

  const createAuthToken = useCallback(async (force = false, silent = false) => {
    // If not forcing and we already have a valid token that's not too old, reuse it
    if (!force && walletAuthToken && lastAuthTime && Date.now() - lastAuthTime < TOKEN_REFRESH_TIME) {
      return walletAuthToken;
    }
    
    // If auth is already in progress, prevent duplicate requests
    if (isAuthInProgress) {
      return null;
    }
    
    // Wallet must be connected first
    if (!publicKey || !signMessage) {
      if (!silent) {
        addNotification('error', 'Wallet must be connected for authentication');
      }
      return null;
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
      const { data, error } = await supabase.functions.invoke('create-wallet-auth', {
        body: {
          wallet: publicKey.toString(),
          signature: Buffer.from(signature).toString('base64'),
          message,
          timestamp
        }
      });
      
      if (error) {
        if (!silent) {
          addNotification('error', 'Failed to authenticate wallet');
        }
        return null;
      }
      
      // Store the JWT
      const token = data?.token;
      if (token) {
        // Store token in state and sessionStorage for persistence during page refreshes
        setWalletAuthToken(token);
        setLastAuthTime(Date.now());
        
        try {
          // Save in sessionStorage for persistence
          sessionStorage.setItem('walletAuthToken', token);
          sessionStorage.setItem('walletAuthTime', Date.now().toString());
        } catch (e) {
          console.error('Error saving token to sessionStorage:', e);
        }
        
        return token;
      }
      
      // If we get here, we didn't get a token
      if (!silent) {
        addNotification('error', 'Authentication failed - no token received');
      }
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // User rejection messages are friendlier
      if (!silent && (errorMessage.includes('cancelled') || errorMessage.includes('rejected') || errorMessage.includes('declined'))) {
        addNotification('info', 'Authentication cancelled');
      } else if (!silent) {
        addNotification('error', `Authentication failed: ${errorMessage}`);
      }
      return null;
    } finally {
      setIsAuthInProgress(false);
    }
  }, [publicKey, signMessage, addNotification, walletAuthToken, lastAuthTime]);

  // Listen for connection state changes and create auth token
  useEffect(() => {
    // Only authenticate when wallet connects, not on every render
    const handleConnection = async () => {
      if (connected && publicKey) {
        // When wallet first connects, authenticate
        const token = await createAuthToken(false, true);
        
        // Show a notification on successful authentication
        if (token) {
          addNotification('success', 'Wallet connected and authenticated');
        } else {
          addNotification('success', 'Wallet connected');
        }
      } else if (!connected) {
        // Clear auth token when wallet disconnects
        setWalletAuthToken(null);
        setLastAuthTime(null);
        // Clear from session storage
        try {
          sessionStorage.removeItem('walletAuthToken');
          sessionStorage.removeItem('walletAuthTime');
        } catch (e) {
          console.error('Error clearing token from sessionStorage:', e);
        }
      }
    };
    
    handleConnection();
  }, [connected, publicKey, addNotification, createAuthToken]);

  // Add a function to check if token is about to expire and refresh if needed
  const ensureAuthenticated = useCallback(async (): Promise<boolean> => {
    // If wallet isn't connected, can't authenticate
    if (!connected || !publicKey) {
      return false;
    }
    
    // If token is missing or expired, recreate silently
    if (!walletAuthToken || !lastAuthTime || Date.now() - lastAuthTime > TOKEN_REFRESH_TIME) {
      const token = await createAuthToken(true, true);
      return !!token;
    }
    
    // Token exists and is valid
    return true;
  }, [connected, publicKey, walletAuthToken, lastAuthTime, createAuthToken]);

  // Handler for expired auth tokens
  const handleAuthExpiration = useCallback(() => {
    // Always clear the token when handler is called
    setWalletAuthToken(null);
    setLastAuthTime(null);
    
    // Clear from session storage
    try {
      sessionStorage.removeItem('walletAuthToken');
      sessionStorage.removeItem('walletAuthTime');
    } catch (e) {
      console.error('Error clearing token from sessionStorage:', e);
    }
    
    // Log for debugging
    console.log('Handling auth token expiration - token cleared');
    
    // Only show a minimal notification
    addNotification('info', 'Please reconnect your wallet');
    
    // Don't auto-retry authentication - let the user decide when to authenticate
  }, [addNotification]);

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
      // First clear our auth token
      setWalletAuthToken(null);
      setLastAuthTime(null);
      
      // Clear from session storage
      try {
        sessionStorage.removeItem('walletAuthToken');
        sessionStorage.removeItem('walletAuthTime');
      } catch (e) {
        console.error('Error clearing token from sessionStorage:', e);
      }
      
      // Then call the native disconnect
      await nativeDisconnect();
      
      // Only show notification after successful disconnect
      addNotification('info', 'Wallet disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect wallet';
      setError(error instanceof Error ? error : new Error(errorMessage));
      addNotification('error', errorMessage);
    }
  }, [nativeDisconnect, addNotification]);

  const signAndSendTransaction = useCallback(async (_transaction: Transaction): Promise<string> => {
    if (!publicKey) {
      const error = new Error('Wallet not connected');
      setError(error);
      throw error;
    }
    
    // First ensure we're authenticated - transactions often need wallet verification
    await ensureAuthenticated();
    
    // Then use the wallet adapter to sign and send the transaction
    try {
      // This part is not implemented yet - depends on selected wallet adapter
      // This will be handled by the Payment service
      throw new Error('Not implemented in this context - use the Payment service instead');
    } catch (error) {
      console.error('Transaction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send transaction';
      const err = error instanceof Error ? error : new Error(errorMessage);
      setError(err);
      throw err;
    }
  }, [publicKey, ensureAuthenticated]);

  // Make authenticate function available for explicit re-authentication if needed
  const authenticate = useCallback(async (silent = false) => {
    if (!connected || !publicKey) {
      if (!silent) {
        addNotification('error', 'Wallet must be connected first');
      }
      return null;
    }
    
    const token = await createAuthToken(true, silent);
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
      authenticate,
      ensureAuthenticated,
      isAuthenticating: isAuthInProgress
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
    const handleWalletNotFound = async (event: WalletNotFoundEvent) => {
      const walletName = event.walletName;
      
      if (walletName) {
        try {
          const success = await mobileWalletAdapter.redirectToWallet(walletName);
          if (!success) {
            console.warn(`Failed to redirect to ${walletName} wallet`);
          }
        } catch (error) {
          console.error(`Error handling wallet not found for ${walletName}:`, error);
        }
      }
    };

    // Add the event listener
    window.addEventListener('wallet-not-found', handleWalletNotFound as EventListener);

    // Enhanced button click interception
    const interceptWalletButtonClicks = (e: MouseEvent) => {
      const path = e.composedPath();
      let walletButton = null;
      let walletName = null;
      
      for (const element of path) {
        if (element instanceof HTMLElement) {
          // Check for Phantom button
          if (
            (element.classList.contains('wallet-adapter-button') && element.getAttribute('data-id') === 'phantom') ||
            element.classList.contains('wallet-adapter-button-phantom') ||
            element.closest('[data-id="phantom"]')
          ) {
            walletButton = element;
            walletName = 'phantom';
            break;
          }
          // Check for Solflare button
          if (
            (element.classList.contains('wallet-adapter-button') && element.getAttribute('data-id') === 'solflare') ||
            element.classList.contains('wallet-adapter-button-solflare') ||
            element.closest('[data-id="solflare"]')
          ) {
            walletButton = element;
            walletName = 'solflare';
            break;
          }
          // Check for Backpack button
          if (
            (element.classList.contains('wallet-adapter-button') && element.getAttribute('data-id') === 'backpack') ||
            element.classList.contains('wallet-adapter-button-backpack') ||
            element.closest('[data-id="backpack"]')
          ) {
            walletButton = element;
            walletName = 'backpack';
            break;
          }
        }
      }
      
      // If we found a wallet button and the wallet is not installed
      if (walletButton && walletName) {
        const isWalletInstalled = mobileWalletAdapter.isWalletInstalled(walletName);
        
        if (!isWalletInstalled) {
          // Prevent default action
          e.preventDefault();
          e.stopPropagation();
          
          // Dispatch custom event
          const walletNotFoundEvent = createWalletNotFoundEvent(walletName);
          window.dispatchEvent(walletNotFoundEvent);
          
          return false;
        }
      }
    };

    // Add a global click handler with better event capture
    document.addEventListener('click', interceptWalletButtonClicks, true);

    return () => {
      window.removeEventListener('wallet-not-found', handleWalletNotFound as EventListener);
      document.removeEventListener('click', interceptWalletButtonClicks, true);
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