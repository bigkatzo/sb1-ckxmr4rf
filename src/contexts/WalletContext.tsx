import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { Transaction, PublicKey } from '@solana/web3.js';
import type { Adapter } from '@solana/wallet-adapter-base';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { SOLANA_CONNECTION } from '../config/solana';
import '@solana/wallet-adapter-react-ui/styles.css';
import '../styles/wallet-modal.css';
import { supabase } from '../lib/supabase';

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
  // Use a ref to track auto-dismiss timeouts and ensure they can be cleared
  const notificationTimeoutsRef = useRef<Record<string, number>>({});
  
  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all timeouts when component unmounts
      Object.values(notificationTimeoutsRef.current).forEach(timeoutId => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);
  
  // Try to recover token from sessionStorage on mount
  useEffect(() => {
    try {
      // First reset any stuck auth state from previous sessions
      setIsAuthInProgress(false);
      
      const storedToken = sessionStorage.getItem('walletAuthToken');
      const storedAuthTime = sessionStorage.getItem('walletAuthTime');
      
      if (storedToken && storedAuthTime) {
        const authTime = parseInt(storedAuthTime, 10);
        // Only restore if token isn't too old
        if (Date.now() - authTime < TOKEN_REFRESH_TIME) {
          setWalletAuthToken(storedToken);
          setLastAuthTime(authTime);
          console.log('Restored auth token from session storage');
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

  // Add periodic check to reset stuck auth state
  useEffect(() => {
    // Function to check and reset auth state if stuck
    const checkAuthState = () => {
      if (isAuthInProgress && lastAuthTime && (Date.now() - lastAuthTime > 60000)) {
        console.log('Auth state appears stuck, resetting...');
        setIsAuthInProgress(false);
      }
    };
    
    // Check every 30 seconds
    const interval = setInterval(checkAuthState, 30000);
    
    // Initial check
    checkAuthState();
    
    return () => clearInterval(interval);
  }, [isAuthInProgress, lastAuthTime]);

  const dismissNotification = useCallback((id: string) => {
    console.log(`Dismissing notification: ${id}`);
    
    // Clear any auto-dismiss timeout for this notification
    if (notificationTimeoutsRef.current[id]) {
      window.clearTimeout(notificationTimeoutsRef.current[id]);
      delete notificationTimeoutsRef.current[id];
    }
    
    // Remove from state
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    // Clean up first - dismiss any notifications with the same message
    // This is more aggressive than just checking for duplicates
    setNotifications(prev => {
      const toKeep = prev.filter(n => n.message !== message);
      
      // Clear timeouts for any notifications we're removing
      prev.forEach(n => {
        if (n.message === message && notificationTimeoutsRef.current[n.id]) {
          window.clearTimeout(notificationTimeoutsRef.current[n.id]);
          delete notificationTimeoutsRef.current[n.id];
        }
      });
      
      return toKeep;
    });
    
    // Generate a unique ID for this notification
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
    const timeoutId = window.setTimeout(() => {
      console.log(`Auto-dismissing notification: ${id}`);
      dismissNotification(id);
    }, 3000);
    
    // Store the timeout ID so we can clear it if needed
    notificationTimeoutsRef.current[id] = timeoutId;
  }, [dismissNotification]);

  const createAuthToken = useCallback(async (force = false, silent = false) => {
    // If not forcing and we already have a valid token that's not too old, reuse it
    if (!force && walletAuthToken && lastAuthTime && Date.now() - lastAuthTime < TOKEN_REFRESH_TIME) {
      console.log('Reusing existing valid auth token');
      return walletAuthToken;
    }
    
    // If auth is already in progress, prevent duplicate requests
    if (isAuthInProgress) {
      console.log('Auth already in progress, waiting...');
      
      // But check if it's been too long - maybe we're stuck
      if (lastAuthTime && Date.now() - lastAuthTime > 10000) {
        console.log('Auth seems stuck, resetting auth state');
        setIsAuthInProgress(false);
      } else {
        return null;
      }
    }
    
    // Wallet must be connected first
    if (!publicKey || !signMessage) {
      if (!silent) {
        addNotification('error', 'Wallet must be connected for authentication');
      }
      return null;
    }
    
    // Track our own "in-flight" state to prevent race conditions
    let thisAuthCancelled = false;
    
    // Set a safety timeout to prevent auth from getting stuck
    const authTimeoutId = setTimeout(() => {
      if (isAuthInProgress && !thisAuthCancelled) {
        console.log('Auth request timed out - resetting auth state');
        setIsAuthInProgress(false);
      }
    }, 30000); // 30 second timeout should be more than enough
    
    try {
      setIsAuthInProgress(true);
      
      // Create a friendly challenge message that clearly explains the purpose
      const timestamp = Date.now();
      const message = `buy merch. manage your orders.`;
      const encodedMessage = new TextEncoder().encode(message);
      
      // Ask user to sign the message - this proves ownership
      const signature = await signMessage(encodedMessage);
      
      // Check if this auth request was superseded or cancelled
      if (thisAuthCancelled) {
        console.log('Auth was cancelled before completion');
        return null;
      }
      
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
      
      // Check again if this auth request was superseded
      if (thisAuthCancelled) {
        console.log('Auth was cancelled after server response');
        return null;
      }
      
      if (error) {
        console.error('Auth token creation error:', error);
        if (!silent) {
          addNotification('error', 'Failed to authenticate wallet');
        }
        return null;
      }
      
      // Store the JWT
      const token = data?.token;
      if (token) {
        console.log('Token received from server:', token.substring(0, 15) + '...');
        
        // Check if we already have the exact same token to prevent duplicate processing
        if (token === walletAuthToken) {
          console.log('Received same token as already stored, no update needed');
          // Still update the lastAuthTime since we verified it's still valid
          setLastAuthTime(Date.now());
          return token;
        }
        
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
        
        // Don't show a notification for successful auth to reduce notification spam
        return token;
      }
      
      // If we get here, we didn't get a token
      console.error('No token received from create-wallet-auth function');
      if (!silent) {
        addNotification('error', 'Authentication failed - no token received');
      }
      return null;
    } catch (error) {
      console.error('Error creating auth token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // User rejection messages are friendlier
      if (!silent && (errorMessage.includes('cancelled') || errorMessage.includes('rejected') || errorMessage.includes('declined'))) {
        addNotification('info', 'Authentication cancelled');
      } else if (!silent) {
        addNotification('error', `Authentication failed: ${errorMessage}`);
      }
      return null;
    } finally {
      // Mark this auth request as done so it won't update state if it was superseded
      thisAuthCancelled = true;
      // Always clear the auth timeout
      clearTimeout(authTimeoutId);
      // Ensure we always reset the auth state
      setIsAuthInProgress(false);
    }
  }, [publicKey, signMessage, addNotification, walletAuthToken, lastAuthTime, isAuthInProgress]);

  // Function to clear all wallet-related notifications
  const clearWalletNotifications = useCallback(() => {
    // Get the IDs of all wallet-related notifications
    const notificationsToRemove = notifications.filter(n => 
      n.message.includes('Wallet') || 
      n.message.includes('wallet') || 
      n.message.includes('authenticated')
    );
    
    // Clear their timeouts
    notificationsToRemove.forEach(n => {
      if (notificationTimeoutsRef.current[n.id]) {
        window.clearTimeout(notificationTimeoutsRef.current[n.id]);
        delete notificationTimeoutsRef.current[n.id];
      }
    });
    
    // Remove them from state
    if (notificationsToRemove.length > 0) {
      setNotifications(prev => 
        prev.filter(n => !notificationsToRemove.some(toRemove => toRemove.id === n.id))
      );
    }
  }, [notifications]);

  // Listen for connection state changes and create auth token
  useEffect(() => {
    // First clean up any existing wallet notifications to avoid stacking them
    clearWalletNotifications();
    
    let isFirstRun = true;
    let authAttempted = false;
    
    // Reset auth in progress on connection state change
    if (!connected) {
      // If wallet disconnected, ensure auth state is reset
      setIsAuthInProgress(false);
    }
    
    if (connected && publicKey) {
      // Reset any stuck auth states when wallet connects
      if (isAuthInProgress) {
        console.log('Resetting stuck auth state on wallet connection');
        setIsAuthInProgress(false);
      }
      
      // When wallet connects, immediately authenticate
      const runAuth = async () => {
        if (authAttempted) return; // Prevent double attempts
        authAttempted = true;
        
        try {
          // We don't show a notification yet - we'll do that after auth attempt
          const token = await createAuthToken(false, true);
          
          // Only show notification on first connection, not on refresh
          if (isFirstRun) {
            // Clear any stale notifications first
            clearWalletNotifications();
            
            if (token) {
              // Only show one notification for the whole process
              addNotification('success', 'Wallet connected and authenticated');
            } else {
              // If auth failed but wallet is connected, still show connection success
              addNotification('success', 'Wallet connected');
            }
            
            isFirstRun = false;
          }
        } catch (error) {
          console.error('Auth error during connection:', error);
          if (isFirstRun) {
            // Clear any stale notifications first
            clearWalletNotifications();
            
            // Still show connection success if auth fails
            addNotification('success', 'Wallet connected');
            isFirstRun = false;
          }
          // Ensure auth state is reset on error
          setIsAuthInProgress(false);
        }
      };
      
      // Start auth after a short delay to ensure wallet is fully connected
      setTimeout(runAuth, 100);
    } else {
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
      
      // Clear any existing wallet notifications when disconnecting
      clearWalletNotifications();
    }
    
    // Clean up function to ensure it's only run once on disconnect
    return () => {
      isFirstRun = false;
    };
  }, [connected, publicKey, addNotification, createAuthToken, clearWalletNotifications]);

  // Add a function to check if token is about to expire and refresh if needed
  const ensureAuthenticated = useCallback(async (): Promise<boolean> => {
    // If wallet isn't connected, can't authenticate
    if (!connected || !publicKey) {
      return false;
    }
    
    // If token is missing, recreate silently
    if (!walletAuthToken) {
      const token = await createAuthToken(true, true);
      return !!token;
    }
    
    // If token exists but is getting old, refresh silently
    if (lastAuthTime && Date.now() - lastAuthTime > TOKEN_REFRESH_TIME * 0.75) {
      console.log('Auth token is aging, refreshing silently...');
      const token = await createAuthToken(true, true);
      return !!token;
    }
    
    // Token exists and is relatively fresh
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