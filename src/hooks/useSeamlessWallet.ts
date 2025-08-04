import { useState, useEffect, useCallback } from 'react';
import { mobileWalletAdapter } from '../services/mobileWalletAdapter';
import { useWallet } from '../contexts/WalletContext';

interface SeamlessWalletState {
  isConnecting: boolean;
  connectionStatus: 'idle' | 'redirecting' | 'connecting' | 'connected' | 'failed';
  lastAttemptedWallet: string | null;
  availableWallets: string[];
  connectionStates: Record<string, boolean>;
}

export function useSeamlessWallet() {
  const { connect, isConnected } = useWallet();
  const [state, setState] = useState<SeamlessWalletState>({
    isConnecting: false,
    connectionStatus: 'idle',
    lastAttemptedWallet: null,
    availableWallets: [],
    connectionStates: {}
  });

  // Monitor wallet availability
  useEffect(() => {
    const updateWalletStates = () => {
      const availableWallets = mobileWalletAdapter.getAvailableWallets();
      const connectionStates = mobileWalletAdapter.getAllWalletStates();
      
      setState(prev => ({
        ...prev,
        availableWallets,
        connectionStates
      }));
    };

    // Initial check
    updateWalletStates();

    // Set up periodic monitoring
    const interval = setInterval(updateWalletStates, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-connect when wallet becomes available
  useEffect(() => {
    if (state.lastAttemptedWallet && 
        state.connectionStatus === 'redirecting' && 
        state.connectionStates[state.lastAttemptedWallet]) {
      
      setState(prev => ({ ...prev, connectionStatus: 'connecting' }));
      
      // Try to connect the wallet
      connect().then(() => {
        setState(prev => ({ 
          ...prev, 
          connectionStatus: 'connected',
          isConnecting: false 
        }));
      }).catch((error) => {
        console.error('Failed to connect wallet after redirect:', error);
        setState(prev => ({ 
          ...prev, 
          connectionStatus: 'failed',
          isConnecting: false 
        }));
      });
    }
  }, [state.connectionStates, state.lastAttemptedWallet, state.connectionStatus, connect]);

  // Auto-connect when wallet is already connected
  useEffect(() => {
    if (isConnected && state.connectionStatus === 'redirecting') {
      setState(prev => ({ 
        ...prev, 
        connectionStatus: 'connected',
        isConnecting: false 
      }));
    }
  }, [isConnected, state.connectionStatus]);

  const connectWallet = useCallback(async (walletName: string) => {
    setState(prev => ({
      ...prev,
      isConnecting: true,
      connectionStatus: 'redirecting',
      lastAttemptedWallet: walletName
    }));

    try {
      // Check if wallet is already available
      if (mobileWalletAdapter.isWalletInstalled(walletName)) {
        setState(prev => ({ ...prev, connectionStatus: 'connecting' }));
        
        await connect();
        setState(prev => ({ 
          ...prev, 
          connectionStatus: 'connected',
          isConnecting: false 
        }));
        return true;
      }

      // Redirect to wallet app
      const success = await mobileWalletAdapter.redirectToWallet(walletName, (redirectSuccess) => {
        if (redirectSuccess) {
          console.log(`Wallet ${walletName} redirect successful`);
        }
      });

      if (!success) {
        setState(prev => ({ 
          ...prev, 
          connectionStatus: 'failed',
          isConnecting: false 
        }));
        return false;
      }

      // The connection will be handled by the useEffect above when wallet becomes available
      return true;
    } catch (error) {
      console.error(`Error connecting to ${walletName}:`, error);
      setState(prev => ({ 
        ...prev, 
        connectionStatus: 'failed',
        isConnecting: false 
      }));
      return false;
    }
  }, [connect]);

  const connectRecommendedWallet = useCallback(async () => {
    const recommendedWallet = mobileWalletAdapter.getRecommendedWallet();
    if (recommendedWallet) {
      return connectWallet(recommendedWallet);
    }
    return false;
  }, [connectWallet]);

  const resetConnectionState = useCallback(() => {
    setState({
      isConnecting: false,
      connectionStatus: 'idle',
      lastAttemptedWallet: null,
      availableWallets: mobileWalletAdapter.getAvailableWallets(),
      connectionStates: mobileWalletAdapter.getAllWalletStates()
    });
  }, []);

  return {
    ...state,
    connectWallet,
    connectRecommendedWallet,
    resetConnectionState,
    isWalletAvailable: (walletName: string) => state.connectionStates[walletName] || false
  };
} 