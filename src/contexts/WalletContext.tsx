import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Transaction, PublicKey, Connection } from '@solana/web3.js';
import { supabase } from '../lib/supabase';

// Custom event for auth expiration
export const AUTH_EXPIRED_EVENT = 'wallet-auth-expired';

// Time after which we should refresh the token (45 minutes)
const TOKEN_REFRESH_TIME = 45 * 60 * 1000;

// Helper function to validate Solana address format
const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

interface WalletNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: number;
}

interface WalletContextType {
  isConnected: boolean;
  walletAddress: string | null;
  publicKey: PublicKey | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleConnect: () => Promise<void>;
  forceDisconnect: () => Promise<void>;
  signAndSendTransaction: (transaction: Transaction) => Promise<string>;
  error: Error | null;
  notifications: WalletNotification[];
  dismissNotification: (id: string) => void;
  walletAuthToken: string | null;
  handleAuthExpiration: () => void;
  authenticate: (silent?: boolean) => Promise<string | null>;
  ensureAuthenticated: () => Promise<boolean>;
  isAuthenticating: boolean;
  // Privy-specific methods
  login: () => void;
  logout: () => void;
  ready: boolean;
  authenticated: boolean;
  user: any;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const { 
    login, 
    logout, 
    ready, 
    authenticated, 
    user, 
    sendTransaction,
    signMessage 
  } = usePrivy();
  
  const [error, setError] = useState<Error | null>(null);
  const [notifications, setNotifications] = useState<WalletNotification[]>([]);
  const [walletAuthToken, setWalletAuthToken] = useState<string | null>(null);
  const [isAuthInProgress, setIsAuthInProgress] = useState(false);
  const [lastAuthTime, setLastAuthTime] = useState<number | null>(null);

  // Get Solana wallet address from Privy user with validation
  const walletAddress = user?.wallet?.address || null;
  
  // Add debugging to see what type of wallet address we're getting
  useEffect(() => {
    if (user?.wallet) {
      console.log('Wallet info:', {
        address: user.wallet.address,
        chainId: user.wallet.chainId,
        chainType: user.wallet.chainType,
        walletClientType: user.wallet.walletClientType
      });
      
      if (user.wallet.address) {
        console.log('Raw wallet address from Privy:', user.wallet.address);
        console.log('Address length:', user.wallet.address.length);
        console.log('Address format check:', /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(user.wallet.address));
        
        try {
          const testKey = new PublicKey(user.wallet.address);
          console.log('PublicKey creation successful:', testKey.toBase58());
        } catch (error) {
          console.error('PublicKey creation failed:', error);
        }
      }
    }
  }, [user?.wallet]);

  // Create PublicKey with validation
  const publicKey = walletAddress && isValidSolanaAddress(walletAddress) 
    ? new PublicKey(walletAddress) 
    : null;
  const isConnected = authenticated && !!walletAddress && !!publicKey;

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
      
      // Ask user to sign the message - this proves ownership
      const signature = await signMessage(message);
      
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
      if (isConnected && publicKey) {
        // When wallet first connects, authenticate
        const token = await createAuthToken(false, true);
        
        // Show a notification on successful authentication
        if (token) {
          addNotification('success', 'Wallet connected and authenticated');
        } else {
          addNotification('success', 'Wallet connected');
        }
      } else if (authenticated && walletAddress && !publicKey) {
        // User is authenticated but has an invalid wallet address (likely Ethereum)
        addNotification('error', 'Please connect a Solana wallet like Phantom');
        setError(new Error('Invalid wallet type. Please connect a Solana wallet.'));
      } else if (!isConnected) {
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
  }, [isConnected, publicKey, authenticated, walletAddress, addNotification, createAuthToken]);

  // Add a function to check if token is about to expire and refresh if needed
  const ensureAuthenticated = useCallback(async (): Promise<boolean> => {
    // If wallet isn't connected, can't authenticate
    if (!isConnected || !publicKey) {
      return false;
    }
    
    // If token is missing or expired, recreate silently
    if (!walletAuthToken || !lastAuthTime || Date.now() - lastAuthTime > TOKEN_REFRESH_TIME) {
      const token = await createAuthToken(true, true);
      return !!token;
    }
    
    // Token exists and is valid
    return true;
  }, [isConnected, publicKey, walletAuthToken, lastAuthTime, createAuthToken]);

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
      
      // If already authenticated, don't try to login again
      if (authenticated) {
        console.log('User already authenticated, skipping login');
        return;
      }
      
      login();
    } catch (error) {
      console.error('Connect error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      
      // Check if it's a base58 error or invalid address error
      if (errorMessage.includes('base58') || errorMessage.includes('Invalid') || errorMessage.includes('non-base')) {
        setError(new Error('Please connect a valid Solana wallet (like Phantom)'));
        addNotification('error', 'Please connect a valid Solana wallet like Phantom');
      } else {
        setError(error instanceof Error ? error : new Error(errorMessage));
        addNotification('error', 'Failed to connect wallet');
      }
      throw error;
    }
  }, [login, addNotification, authenticated]);

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
      logout();
      
      // Only show notification after successful disconnect
      addNotification('info', 'Wallet disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect wallet';
      setError(error instanceof Error ? error : new Error(errorMessage));
      addNotification('error', errorMessage);
    }
  }, [logout, addNotification]);

  // Add a toggle function for better UX
  const toggleConnect = useCallback(async () => {
    try {
      setError(null);
      
      if (authenticated && isConnected) {
        // If connected, disconnect
        await disconnect();
      } else {
        // If not connected, connect
        await connect();
      }
    } catch (error) {
      console.error('Toggle connect error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to toggle wallet connection';
      setError(error instanceof Error ? error : new Error(errorMessage));
      addNotification('error', errorMessage);
    }
  }, [authenticated, isConnected, connect, disconnect, addNotification]);

  const signAndSendTransaction = useCallback(async (transaction: Transaction): Promise<string> => {
    if (!publicKey) {
      const error = new Error('Wallet not connected');
      setError(error);
      throw error;
    }
    
    // First ensure we're authenticated - transactions often need wallet verification
    await ensureAuthenticated();
    
    // Then use Privy to sign and send the transaction
    try {
      // For Solana transactions with Privy, we need to use the wallet's native methods
      // Check if we have access to the wallet through window.solana
      if ((window as any).solana) {
        const { signature } = await (window as any).solana.signAndSendTransaction(transaction);
        return signature;
      } else {
        throw new Error('No Solana wallet available for transaction signing');
      }
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
    if (!isConnected || !publicKey) {
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
  }, [createAuthToken, isConnected, publicKey, addNotification]);

  // Add a force disconnect function to clear all Privy state
  const forceDisconnect = useCallback(async () => {
    try {
      setError(null);
      
      // Clear all local state
      setWalletAuthToken(null);
      setLastAuthTime(null);
      
      // Clear from session storage
      try {
        sessionStorage.removeItem('walletAuthToken');
        sessionStorage.removeItem('walletAuthTime');
        // Also clear any Privy-related storage
        localStorage.removeItem('privy');
        sessionStorage.removeItem('privy');
      } catch (e) {
        console.error('Error clearing storage:', e);
      }
      
      // Call Privy logout
      logout();
      
      addNotification('info', 'Wallet forcefully disconnected');
      console.log('Force disconnect completed');
    } catch (error) {
      console.error('Force disconnect error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to force disconnect';
      setError(error instanceof Error ? error : new Error(errorMessage));
      addNotification('error', errorMessage);
    }
  }, [logout, addNotification]);

  // Add chain validation
  const validateSolanaChain = useCallback(() => {
    if (user?.wallet) {
      const chainId = user.wallet.chainId;
      const chainType = user.wallet.chainType;
      
      console.log('Chain validation:', { chainId, chainType });
      
      // Check if connected to Solana chain (handle both string and number chainId)
      // Solana can be identified as 'solana' (string) or '7565164' (chain ID)
      const isSolanaChain = chainId && (
        chainId.toString() === 'solana' || 
        chainId.toString() === '7565164'
      );
      
      if (!isSolanaChain || chainType !== 'solana') {
        console.warn('User connected to wrong chain:', { chainId, chainType });
        addNotification('error', 'Please connect to Solana network in your wallet');
        return false;
      }
      
      return true;
    }
    return false;
  }, [user?.wallet, addNotification]);

  // Add effect to validate chain on connection
  useEffect(() => {
    if (authenticated && user?.wallet) {
      validateSolanaChain();
    }
  }, [authenticated, user?.wallet, validateSolanaChain]);

  return (
    <WalletContext.Provider value={{
      isConnected,
      walletAddress,
      publicKey,
      connect,
      disconnect,
      toggleConnect,
      forceDisconnect,
      signAndSendTransaction,
      error,
      notifications,
      dismissNotification,
      walletAuthToken,
      handleAuthExpiration,
      authenticate,
      ensureAuthenticated,
      isAuthenticating: isAuthInProgress,
      // Privy-specific methods
      login,
      logout,
      ready,
      authenticated,
      user
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WalletContextProvider>
      {children}
    </WalletContextProvider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}