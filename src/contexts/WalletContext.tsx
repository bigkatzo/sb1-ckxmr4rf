import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Transaction, PublicKey, Connection } from '@solana/web3.js';
import { supabase } from '../lib/supabase';
import { initializeMobileWalletAdapter, isMobile, isTWA, getBestWallet, detectWallets } from '../utils/mobileWalletAdapter';

// Custom event for auth expiration
export const AUTH_EXPIRED_EVENT = 'wallet-auth-expired';

// Helper function to validate Solana address
const isValidSolanaAddress = (address: string): boolean => {
  if (!address || typeof address !== 'string') return false;
  
  // Solana addresses are base58 encoded and typically 32-44 characters
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address);
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

  // Use refs to prevent unnecessary re-renders
  const connectionHandledRef = useRef(false);
  const lastWalletAddressRef = useRef<string | null>(null);
  const lastAuthenticatedRef = useRef(false);
  const mobileAdapterInitializedRef = useRef(false);

  // Get Solana wallet address from Privy user with validation
  const walletAddress = user?.wallet?.address || null;
  
  // Create PublicKey with validation - memoized to prevent unnecessary recalculations
  const publicKey = React.useMemo(() => {
    return walletAddress && isValidSolanaAddress(walletAddress) 
      ? new PublicKey(walletAddress) 
      : null;
  }, [walletAddress]);

  const isConnected = authenticated && !!walletAddress && !!publicKey;

  // Initialize mobile wallet adapter on mount
  useEffect(() => {
    if (!mobileAdapterInitializedRef.current && typeof window !== 'undefined') {
      initializeMobileWalletAdapter();
      mobileAdapterInitializedRef.current = true;
      
      // For TWA environments, we might need to retry wallet detection after a delay
      const isTWAEnv = isTWA();
      if (isTWAEnv) {
        console.log('TWA environment detected, setting up retry mechanism...');
        setTimeout(() => {
          console.log('Retrying wallet detection in TWA environment...');
          const wallets = detectWallets();
          console.log('TWA retry wallet detection results:', wallets);
        }, 3000);
      }
    }
  }, []);

  // Add notification helper
  const addNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    const notification: WalletNotification = {
      id,
      type,
      message,
      timestamp: Date.now()
    };
    
    // Add detailed logging for debugging
    console.log(`🔔 Notification triggered:`, {
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
      stack: new Error().stack?.split('\n').slice(1, 4).join('\n') // Get call stack
    });
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto-dismiss success and info notifications after 5 seconds
    if (type !== 'error') {
      setTimeout(() => {
        dismissNotification(id);
      }, 5000);
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Create auth token helper
  const createAuthToken = useCallback(async (silent: boolean = false, skipValidation: boolean = false): Promise<string | null> => {
    if (!walletAddress || !publicKey) {
      if (!silent) {
        console.warn('Cannot create auth token: no wallet address or public key');
      }
      return null;
    }

    // Check if we already have a valid token
    if (walletAuthToken && lastAuthTime) {
      const tokenAge = Date.now() - lastAuthTime;
      const tokenLifetime = 24 * 60 * 60 * 1000; // 24 hours
      
      if (tokenAge < tokenLifetime) {
        if (!silent) {
          console.log('Using existing auth token');
        }
        return walletAuthToken;
      }
    }

    try {
      setIsAuthInProgress(true);
      
      // Create a simple token based on wallet address and timestamp
      const tokenData = {
        walletAddress,
        timestamp: Date.now(),
        chain: 'solana'
      };
      
      const token = btoa(JSON.stringify(tokenData));
      const authToken = `solana_${token}`;
      
      setWalletAuthToken(authToken);
      setLastAuthTime(Date.now());
      
      // Store in session storage for persistence
      try {
        sessionStorage.setItem('walletAuthToken', authToken);
        sessionStorage.setItem('walletAuthTime', Date.now().toString());
      } catch (e) {
        console.error('Error storing token in sessionStorage:', e);
      }
      
      if (!silent) {
        console.log('Auth token created successfully');
      }
      
      return authToken;
    } catch (error) {
      console.error('Error creating auth token:', error);
      if (!silent) {
        addNotification('error', 'Failed to authenticate wallet');
      }
      return null;
    } finally {
      setIsAuthInProgress(false);
    }
  }, [walletAddress, publicKey, walletAuthToken, lastAuthTime, addNotification]);

  // Authenticate helper
  const authenticate = useCallback(async (silent: boolean = false): Promise<string | null> => {
    return createAuthToken(silent);
  }, [createAuthToken]);

  // Ensure authenticated helper
  const ensureAuthenticated = useCallback(async (): Promise<boolean> => {
    const token = await authenticate(true);
    return !!token;
  }, [authenticate]);

  // Handle auth expiration
  const handleAuthExpiration = useCallback(() => {
    setWalletAuthToken(null);
    setLastAuthTime(null);
    addNotification('info', 'Wallet authentication expired. Please reconnect.');
  }, [addNotification]);

  // Add event listener for auth expiration
  useEffect(() => {
    const handleAuthExpiredEvent = () => {
      handleAuthExpiration();
    };
    
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpiredEvent);
    
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpiredEvent);
    };
  }, [handleAuthExpiration]);

  // Optimized connection handling - only run when connection state actually changes
  useEffect(() => {
    // Check if connection state has actually changed
    const walletChanged = lastWalletAddressRef.current !== walletAddress;
    const authChanged = lastAuthenticatedRef.current !== authenticated;
    
    if (!walletChanged && !authChanged) {
      return; // No change, skip processing
    }
    
    // Update refs
    lastWalletAddressRef.current = walletAddress;
    lastAuthenticatedRef.current = authenticated;
    
    const handleConnection = async () => {
      console.log('🔄 Handling connection:', {
        isConnected,
        hasPublicKey: !!publicKey,
        authenticated,
        hasWalletAddress: !!walletAddress,
        walletAddress: walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : null
      });
      
      if (isConnected && publicKey) {
        console.log('✅ Wallet connected successfully, creating auth token...');
        // When wallet first connects, authenticate
        const token = await createAuthToken(false, true);
        
        // Show a notification on successful authentication
        if (token) {
          console.log('✅ Auth token created, showing success notification');
          addNotification('success', 'Wallet connected and authenticated');
        } else {
          console.log('⚠️ No auth token created, showing basic success notification');
          addNotification('success', 'Wallet connected');
        }
      } else if (authenticated && walletAddress && !publicKey) {
        console.log('❌ User authenticated but invalid wallet address detected');
        // User is authenticated but has an invalid wallet address (likely Ethereum)
        // Only show this error if we're not in the middle of a successful connection
        if (!isConnected) {
          console.log('❌ Showing error notification for invalid wallet type');
          addNotification('error', 'Please connect a Solana wallet like Phantom');
          setError(new Error('Invalid wallet type. Please connect a Solana wallet.'));
        } else {
          console.log('⚠️ Skipping error notification - wallet is connected');
        }
      } else if (!isConnected) {
        console.log('🔌 Wallet disconnected, clearing auth data');
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

  const connect = useCallback(async () => {
    try {
      setError(null);
      
      // If already authenticated, don't try to login again
      if (authenticated) {
        console.log('User already authenticated, skipping login');
        return;
      }
      
      // Check if we're on mobile and suggest the best wallet
      const isMobileEnv = isMobile();
      const isTWAEnv = isTWA();
      
      if (isMobileEnv || isTWAEnv) {
        console.log('Mobile/TWA environment detected');
        const bestWallet = getBestWallet();
        if (bestWallet) {
          console.log(`Mobile environment detected, best wallet: ${bestWallet}`);
          
          // For TWA environments, we might need to wait a bit before attempting connection
          if (isTWAEnv) {
            console.log('TWA environment detected, waiting for wallet injection...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } else {
          console.log('No wallet detected on mobile, will attempt standard login');
        }
      }
      
      console.log('Attempting Privy login...');
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

  // Force disconnect utility
  const forceDisconnect = useCallback(async () => {
    try {
      // Clear all state
      setWalletAuthToken(null);
      setLastAuthTime(null);
      setError(null);
      
      // Clear from session storage
      try {
        sessionStorage.removeItem('walletAuthToken');
        sessionStorage.removeItem('walletAuthTime');
        localStorage.removeItem('privy:auth');
        localStorage.removeItem('privy:user');
      } catch (e) {
        console.error('Error clearing storage:', e);
      }
      
      // Call logout
      logout();
      
      addNotification('info', 'Wallet force disconnected');
    } catch (error) {
      console.error('Force disconnect error:', error);
      addNotification('error', 'Failed to force disconnect');
    }
  }, [logout, addNotification]);

  // Add chain validation - memoized to prevent unnecessary recalculations
  const validateSolanaChain = useCallback(() => {
    console.log('🔍 Validating Solana chain...');
    
    if (user?.wallet) {
      const chainId = user.wallet.chainId;
      const chainType = user.wallet.chainType;
      
      console.log('🔍 Chain validation details:', { 
        chainId, 
        chainType, 
        walletAddress: walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : null,
        isValidAddress: walletAddress ? isValidSolanaAddress(walletAddress) : false
      });
      
      // More flexible Solana chain detection
      // Solana can be identified in multiple ways:
      const isSolanaChain = chainId && (
        chainId.toString() === 'solana' || 
        chainId.toString() === '7565164' ||
        chainId.toString() === 'mainnet-beta' ||
        chainId.toString() === 'mainnet' ||
        chainType === 'solana' ||
        // Check if the wallet address is a valid Solana address (this is the most reliable)
        (walletAddress && isValidSolanaAddress(walletAddress))
      );
      
      console.log('🔍 Solana chain check result:', { isSolanaChain });
      
      if (!isSolanaChain) {
        console.warn('❌ User connected to wrong chain:', { chainId, chainType, walletAddress });
        // Only show error if we have a wallet address but it's not a valid Solana address
        if (walletAddress && !isValidSolanaAddress(walletAddress)) {
          console.log('❌ Showing error notification for invalid Solana address');
          addNotification('error', 'Please connect to Solana network in your wallet');
          return false;
        } else {
          console.log('⚠️ Chain validation failed but wallet address is valid, not showing error');
        }
      } else {
        console.log('✅ Solana chain validation passed');
      }
      
      return true;
    } else {
      console.log('⚠️ No user wallet data available for chain validation');
    }
    return false;
  }, [user?.wallet, walletAddress, addNotification]);

  // Add effect to validate chain on connection - only when user changes
  useEffect(() => {
    if (authenticated && user?.wallet && !connectionHandledRef.current) {
      // Only validate chain if we have a valid wallet address
      if (walletAddress && isValidSolanaAddress(walletAddress)) {
        validateSolanaChain();
      }
      connectionHandledRef.current = true;
    } else if (!authenticated) {
      connectionHandledRef.current = false;
    }
  }, [authenticated, user?.wallet, walletAddress, validateSolanaChain]);

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