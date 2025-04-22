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
import { createClient } from '@supabase/supabase-js';

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
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, connected, disconnect: nativeDisconnect, signMessage } = useSolanaWallet();
  const [error, setError] = useState<Error | null>(null);
  const [notifications, setNotifications] = useState<WalletNotification[]>([]);
  const [walletAuthToken, setWalletAuthToken] = useState<string | null>(null);

  const addNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
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
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Function to create a secure authentication token
  const createAuthToken = useCallback(async () => {
    if (!publicKey || !signMessage) return null;
    
    try {
      // Create a challenge message that includes the wallet address and timestamp
      const timestamp = Date.now();
      const message = `Authenticate wallet ${publicKey.toString()} with StoreDotFun at ${timestamp}`;
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
        addNotification('success', 'Wallet identity verified');
        
        // Set the auth token in Supabase for future requests
        console.log('Setting token in Supabase client...');
        try {
          const sessionResult = await supabase.auth.setSession({
            access_token: token,
            refresh_token: ''
          });
          
          if (sessionResult.error) {
            console.error('Error setting token in session:', sessionResult.error);
            
            // Even if session setting fails, we can still use the token for API calls
            // through custom headers, so we'll proceed anyway
            
            // Try to test the token with a simple API call
            console.log('Testing token with a simple API call...');
            try {
              // Create a new client with the token in authorization header
              const testClient = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
                global: {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                }
              });
              
              // Try a simple query to test the token
              const { data: testData, error: testError } = await testClient
                .from('user_orders')
                .select('*', { count: 'exact', head: true });
              
              if (testError) {
                console.error('Token validation failed:', testError);
              } else {
                console.log('Token works with authorization header:', testData);
              }
            } catch (testError) {
              console.error('Error testing token:', testError);
            }
          } else {
            console.log('Token successfully set in session');
            
            // Verify the token was applied correctly
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session?.access_token) {
              console.warn('Token not set in session properly, will use header authorization instead');
            }
          }
        } catch (sessionError) {
          console.error('Exception setting session:', sessionError);
          // Continue anyway - we'll use the token for API calls
        }
        
        return token;
      }
      
      // If we get here, we didn't get a token
      console.error('No token received from create-wallet-auth function');
      addNotification('error', 'Authentication failed - no token received');
      return null;
    } catch (error) {
      console.error('Error creating auth token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addNotification('error', `Authentication failed: ${errorMessage}`);
      return null;
    }
  }, [publicKey, signMessage, addNotification]);

  // Listen for connection state changes and create auth token
  useEffect(() => {
    if (connected && publicKey) {
      addNotification('success', 'Wallet connected!');
      // Create authentication token when wallet connects
      createAuthToken().catch(console.error);
    } else {
      // Clear auth token when wallet disconnects
      setWalletAuthToken(null);
    }
  }, [connected, publicKey, addNotification, createAuthToken]);

  // Handler for expired auth tokens
  const handleAuthExpiration = useCallback(() => {
    // Clear existing token
    setWalletAuthToken(null);
    
    // Notify user that reauthentication is needed
    addNotification('info', 'Session expired, please reconnect your wallet');
    
    // Always try to recreate the auth token if wallet is connected
    if (connected && publicKey && signMessage) {
      console.log('Automatically attempting to recreate wallet auth token');
      createAuthToken().then(token => {
        if (token) {
          console.log('Successfully recreated wallet auth token');
          // Set the auth token in Supabase for future requests
          supabase.auth.setSession({
            access_token: token,
            refresh_token: ''
          });
        } else {
          console.error('Failed to recreate wallet auth token');
        }
      }).catch(error => {
        console.error('Error recreating auth token:', error);
      });
    }
  }, [connected, publicKey, signMessage, addNotification, createAuthToken]);

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
      await nativeDisconnect();
      // Clear auth token
      setWalletAuthToken(null);
      // Clear Supabase session
      await supabase.auth.signOut();
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
      handleAuthExpiration
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