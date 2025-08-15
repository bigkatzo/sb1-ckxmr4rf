import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePrivy, useSendTransaction } from '@privy-io/react-auth';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { Transaction, PublicKey, Connection } from '@solana/web3.js';
// import { supabase } from '../lib/supabase';
import { initializeMobileWalletAdapter, isMobile, isTWA, getBestWallet, detectWallets } from '../utils/mobileWalletAdapter';
import { SOLANA_CONNECTION } from '../config/solana';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

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
  // Embedded wallet methods
  isEmbeddedWallet: boolean;
  embeddedWalletAddress: string | null;
  createEmbeddedWallet: () => Promise<void>;
  createSolanaEmbeddedWallet: () => Promise<void>;
  exportEmbeddedWallet: () => Promise<any>;
  getEmbeddedWalletBalance: () => Promise<number | null>;
  isExportingWallet: boolean;
  transactionHistory: any[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

function WalletContextProvider({ children }: { children: React.ReactNode }) {
  const { 
    login, 
    logout, 
    ready, 
    authenticated, 
    user, 
    signMessage,
    createWallet,
    linkWallet,
    unlinkWallet,
    // Add new embedded wallet methods
    exportWallet
  } = usePrivy();
  
  // Add Solana-specific hooks
  const { wallets: solanaWallets } = useSolanaWallets();
  const { sendTransaction } = useSendTransaction();
  
  const [error, setError] = useState<Error | null>(null);
  const [notifications, setNotifications] = useState<WalletNotification[]>([]);
  const [walletAuthToken, setWalletAuthToken] = useState<string | null>(null);
  const [isAuthInProgress, setIsAuthInProgress] = useState(false);
  const [lastAuthTime, setLastAuthTime] = useState<number | null>(null);
  const [embeddedWalletAddress, setEmbeddedWalletAddress] = useState<string | null>(null);
  // Add enhanced embedded wallet state
  const [isExportingWallet, setIsExportingWallet] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);

  // Use refs to prevent unnecessary re-renders
  const connectionHandledRef = useRef(false);
  const lastWalletAddressRef = useRef<string | null>(null);
  const lastAuthenticatedRef = useRef(false);
  const mobileAdapterInitializedRef = useRef(false);

  // Check if user has a Solana embedded wallet from Privy
  const isEmbeddedWallet = user?.linkedAccounts?.some((account: any) => 
    account.type === 'wallet' && 
    (account as any).walletClientType === 'privy' &&
    (account as any).chainType === 'solana'
  ) || false;

  // Get the embedded wallet address from Privy user - prioritize Solana over Ethereum
  const getEmbeddedWalletAddress = useCallback(() => {
    console.log('🔍 Searching for embedded wallet address...');
    console.log('User linked accounts:', user?.linkedAccounts);
    
    if (user?.linkedAccounts) {
      // First, try to find a Solana embedded wallet
      const solanaEmbeddedWallet = user.linkedAccounts.find((account: any) => 
        account.type === 'wallet' && 
        (account as any).walletClientType === 'privy' &&
        (account as any).chainType === 'solana'
      );
      
      if (solanaEmbeddedWallet) {
        const address = (solanaEmbeddedWallet as any)?.address;
        console.log('✅ Found Solana embedded wallet:', address);
        return address || null;
      }
      
      // If no Solana wallet, fall back to any embedded wallet (but warn about Ethereum)
      const anyEmbeddedWallet = user.linkedAccounts.find((account: any) => 
        account.type === 'wallet' && (account as any).walletClientType === 'privy'
      );
      
      if (anyEmbeddedWallet) {
        const walletAddress = (anyEmbeddedWallet as any)?.address;
        const chainType = (anyEmbeddedWallet as any)?.chainType;
        
        console.log('⚠️ Found embedded wallet (not Solana):', { address: walletAddress, chainType });
        
        if (chainType === 'ethereum') {
          console.warn('⚠️ Found Ethereum embedded wallet instead of Solana:', walletAddress);
        }
        
        return walletAddress || null;
      }
    }
    
    console.log('❌ No embedded wallet found');
    return null;
  }, [user?.linkedAccounts]);

  // Get Solana wallet address from Privy user with validation
  // Priority: 1. Solana embedded wallet address, 2. Solana external wallet address, 3. Local embedded wallet address
  const walletAddress = (() => {
    // First, try to get Solana embedded wallet address
    const embeddedWalletAddress = getEmbeddedWalletAddress();
    if (embeddedWalletAddress && isValidSolanaAddress(embeddedWalletAddress)) {
      console.log('✅ Using Solana embedded wallet address:', embeddedWalletAddress);
      return embeddedWalletAddress;
    }
    
    // Second, check if external wallet is Solana
    const externalWalletAddress = user?.wallet?.address;
    if (externalWalletAddress && isValidSolanaAddress(externalWalletAddress)) {
      console.log('✅ Using Solana external wallet address:', externalWalletAddress);
      return externalWalletAddress;
    }
    
    // Third, fall back to local embedded wallet address
    if (embeddedWalletAddress) {
      console.log('⚠️ Using embedded wallet address (may not be Solana):', embeddedWalletAddress);
      return embeddedWalletAddress;
    }
    
    // Finally, fall back to external wallet address (even if not Solana)
    if (externalWalletAddress) {
      console.log('⚠️ Using external wallet address (may not be Solana):', externalWalletAddress);
      return externalWalletAddress;
    }
    
    return null;
  })();
  
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

  // Create embedded wallet for users who sign in with social logins
  const createEmbeddedWallet = useCallback(async () => {
    if (!authenticated || !user) {
      console.warn('Cannot create embedded wallet: user not authenticated');
      return;
    }

    if (isEmbeddedWallet) {
      console.log('User already has an embedded wallet');
      return;
    }

    try {
      console.log('Creating Solana embedded wallet for user...');
      
      // Create embedded wallet - Privy should use the configuration to create Solana wallet
      const wallet = await createWallet();
      
      if (wallet && wallet.address) {
        console.log('Embedded wallet created successfully:', wallet.address);
        setEmbeddedWalletAddress(wallet.address);
        addNotification('success', 'Embedded wallet created successfully');
      } else {
        console.error('Failed to create embedded wallet: no address returned');
        addNotification('error', 'Failed to create embedded wallet');
      }
    } catch (error) {
      console.error('Error creating embedded wallet:', error);
      addNotification('error', 'Failed to create embedded wallet');
    }
  }, [authenticated, user, isEmbeddedWallet, createWallet, addNotification]);

  // Create Solana embedded wallet specifically
  const createSolanaEmbeddedWallet = useCallback(async () => {
    if (!authenticated || !user) {
      console.warn('Cannot create Solana embedded wallet: user not authenticated');
      return;
    }

    try {
      console.log('Forcing creation of Solana embedded wallet...');
      
      // Force create a wallet - should be Solana based on configuration
      const wallet = await createWallet();
      
      if (wallet && wallet.address) {
        console.log('Embedded wallet created successfully:', wallet.address);
        setEmbeddedWalletAddress(wallet.address);
        addNotification('success', 'Embedded wallet created successfully');
      } else {
        console.error('Failed to create embedded wallet: no address returned');
        addNotification('error', 'Failed to create embedded wallet');
      }
    } catch (error) {
      console.error('Error creating embedded wallet:', error);
      addNotification('error', 'Failed to create embedded wallet');
    }
  }, [authenticated, user, createWallet, addNotification]);

  // Export embedded wallet
  const exportEmbeddedWallet = useCallback(async () => {
    if (!authenticated || !user || !isEmbeddedWallet) {
      console.warn('Cannot export wallet: user not authenticated or no embedded wallet');
      return null;
    }

    try {
      setIsExportingWallet(true);
      console.log('Exporting embedded wallet...');
      
      await exportWallet();
      
      console.log('Wallet exported successfully');
      addNotification('success', 'Wallet exported successfully');
      return { success: true, message: 'Wallet exported successfully' };
    } catch (error) {
      console.error('Error exporting wallet:', error);
      addNotification('error', 'Failed to export wallet');
      return null;
    } finally {
      setIsExportingWallet(false);
    }
  }, [authenticated, user, isEmbeddedWallet, exportWallet, addNotification]);

  // Get wallet balance
  const getEmbeddedWalletBalance = useCallback(async () => {
    if (!authenticated || !user || !isEmbeddedWallet || !walletAddress) {
      console.warn('Cannot get balance: user not authenticated or no embedded wallet');
      return null;
    }

    try {
      console.log('Getting embedded wallet balance...');
      
      // Use Solana connection to get balance
      const connection = new Connection(SOLANA_CONNECTION.rpcEndpoint);
      const balance = await connection.getBalance(new PublicKey(walletAddress));
      
      const balanceInSOL = balance / LAMPORTS_PER_SOL;
      setWalletBalance(balanceInSOL.toString());
      
      console.log('Wallet balance:', balanceInSOL, 'SOL');
      return balanceInSOL;
    } catch (error) {
      console.error('Error getting wallet balance:', error);
      addNotification('error', 'Failed to get wallet balance');
      return null;
    }
  }, [authenticated, user, isEmbeddedWallet, walletAddress, addNotification]);

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
        chain: 'solana',
        isEmbeddedWallet
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
  }, [walletAddress, publicKey, walletAuthToken, lastAuthTime, isEmbeddedWallet, addNotification]);

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
        walletAddress: walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : null,
        isEmbeddedWallet,
        embeddedWalletAddress: getEmbeddedWalletAddress()
      });
      
      if (isConnected && publicKey) {
        console.log('✅ Wallet connected successfully, creating auth token...');
        // When wallet first connects, authenticate
        const token = await createAuthToken(false, true);
        
        // Show a notification on successful authentication
        if (token) {
          console.log('✅ Auth token created, showing success notification');
          const walletType = isEmbeddedWallet ? 'Embedded wallet' : 'Wallet';
          addNotification('success', `${walletType} connected`); // Only show 'connected'
        } else {
          console.log('⚠️ No auth token created, showing basic success notification');
          const walletType = isEmbeddedWallet ? 'Embedded wallet' : 'Wallet';
          addNotification('success', `${walletType} connected`);
        }
      } else if (authenticated && walletAddress && !publicKey) {
        console.log('❌ User authenticated but invalid wallet address detected');
        
        // Check if this is an Ethereum address (starts with 0x)
        const isEthereumAddress = walletAddress.startsWith('0x');
        
        if (isEthereumAddress) {
          console.log('❌ Ethereum wallet detected instead of Solana wallet');
          addNotification('error', 'Ethereum wallet detected. Please use a Solana wallet or contact support.');
          setError(new Error('Ethereum wallet detected. This application requires Solana wallets.'));
        } else {
          // User is authenticated but has an invalid wallet address
          // Only show this error if we're not in the middle of a successful connection
          if (!isConnected) {
            console.log('❌ Showing error notification for invalid wallet type');
            addNotification('error', 'Please connect a Solana wallet like Phantom');
            setError(new Error('Invalid wallet type. Please connect a Solana wallet.'));
          } else {
            console.log('⚠️ Skipping error notification - wallet is connected');
          }
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
  }, [isConnected, publicKey, authenticated, walletAddress, isEmbeddedWallet, addNotification, createAuthToken, getEmbeddedWalletAddress]);

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
      setEmbeddedWalletAddress(null);
      
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
    if (!publicKey || !walletAddress) {
      throw new Error('Wallet not connected');
    }
    
    await ensureAuthenticated();
    
    try {
      const connection = new Connection(SOLANA_CONNECTION.rpcEndpoint);
      
      // Prepare transaction
      if (!transaction.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }
      
      if (!transaction.feePayer) {
        transaction.feePayer = publicKey;
      }

      if (isEmbeddedWallet) {
        console.log('Using Privy embedded wallet for transaction...');
        
        try {
          // For embedded wallets, use the Solana wallet's direct sendTransaction method
          const embeddedWallet = solanaWallets.find(wallet => 
            wallet.walletClientType === 'privy'
          );
          
          if (embeddedWallet?.sendTransaction) {
            try {
              const result = await embeddedWallet.sendTransaction(transaction, connection);
              
              // Handle different result types
              const signature = typeof result === 'string' ? result : (result as any)?.signature || result;
              console.log('✅ Embedded wallet transaction sent:', signature);
              return signature;
              
            } catch (directError) {
              console.error('Direct wallet method failed:', directError);
              throw new Error(`Embedded wallet transaction failed: ${directError instanceof Error ? directError.message : 'Unknown error'}`);
            }
          } else {
            throw new Error('No embedded wallet found for transaction signing');
          }
        } catch (error) {
          console.error('Embedded wallet transaction error:', error);
          throw new Error('Failed to sign transaction with embedded wallet');
        }
        
      } else {
        // External wallet handling
        if (!(window as any).solana) {
          throw new Error('No Solana wallet found. Please install Phantom or another Solana wallet.');
        }
        
        const result = await (window as any).solana.signAndSendTransaction(transaction);
        return result.signature || result;
      }
      
    } catch (error) {
      console.error('Transaction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send transaction';
      const err = error instanceof Error ? error : new Error(errorMessage);
      setError(err);
      throw err;
    }
  }, [
    publicKey, 
    walletAddress, 
    ensureAuthenticated, 
    isEmbeddedWallet, 
    sendTransaction,
    solanaWallets
  ]);

  // Force disconnect utility
  const forceDisconnect = useCallback(async () => {
    try {
      // Clear all state
      setWalletAuthToken(null);
      setLastAuthTime(null);
      setError(null);
      setEmbeddedWalletAddress(null);
      
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
      // For embedded wallets, we don't need to validate chain as they're always Solana
      if (isEmbeddedWallet) {
        console.log('✅ Embedded wallet detected, skipping chain validation');
        return true;
      }
      
      // For external wallets, check if the address is a valid Solana address
      if (walletAddress && isValidSolanaAddress(walletAddress)) {
        console.log('✅ Solana address validation passed');
        return true;
      } else {
        console.log('❌ Invalid Solana address detected');
        addNotification('error', 'Please connect a valid Solana wallet');
        return false;
      }
    } else {
      console.log('⚠️ No user wallet data available for chain validation');
    }
    return false;
  }, [user?.wallet, walletAddress, isEmbeddedWallet, addNotification]);

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

  // Effect to handle embedded wallet creation for social login users
  useEffect(() => {
    if (authenticated && user && !isEmbeddedWallet && !user.wallet) {
      // User is authenticated but has no wallet - they likely signed in with social login
      // Check if they have an email (required for embedded wallet)
      const hasEmail = user.email?.address || user.linkedAccounts?.some((account: any) => 
        account.type === 'email' && account.email
      );
      
      if (hasEmail) {
        console.log('User signed in with social login, creating embedded wallet...');
        // Delay creation to ensure user is fully authenticated
        setTimeout(() => {
          createEmbeddedWallet();
        }, 1000);
      }
    }
  }, [authenticated, user, isEmbeddedWallet, createEmbeddedWallet]);

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
      user,
      // Embedded wallet methods
      isEmbeddedWallet,
      embeddedWalletAddress: getEmbeddedWalletAddress(),
      createEmbeddedWallet,
      createSolanaEmbeddedWallet,
      exportEmbeddedWallet,
      getEmbeddedWalletBalance,
      isExportingWallet,
      transactionHistory
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