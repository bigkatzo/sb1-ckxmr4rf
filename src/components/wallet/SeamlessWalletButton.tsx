import React from 'react';
import { useSeamlessWallet } from '../../hooks/useSeamlessWallet';
import { WALLET_CONFIGS } from '../../services/mobileWalletAdapter';

interface SeamlessWalletButtonProps {
  walletName?: string;
  className?: string;
  children?: React.ReactNode;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function SeamlessWalletButton({ 
  walletName, 
  className = '', 
  children,
  onSuccess,
  onError 
}: SeamlessWalletButtonProps) {
  const { 
    connectWallet, 
    connectRecommendedWallet, 
    isConnecting, 
    connectionStatus,
    availableWallets,
    connectionStates 
  } = useSeamlessWallet();

  const handleClick = async () => {
    try {
      let success = false;
      
      if (walletName) {
        success = await connectWallet(walletName);
      } else {
        success = await connectRecommendedWallet();
      }

      if (success) {
        onSuccess?.();
      } else {
        onError?.('Failed to connect wallet');
      }
    } catch (error) {
      console.error('Wallet connection error:', error);
      onError?.(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const getButtonText = () => {
    if (isConnecting) {
      switch (connectionStatus) {
        case 'redirecting':
          return 'Opening Wallet...';
        case 'connecting':
          return 'Connecting...';
        default:
          return 'Connecting...';
      }
    }

    if (children) {
      return children;
    }

    if (walletName) {
      const config = WALLET_CONFIGS[walletName];
      return config ? `Connect ${config.name}` : `Connect ${walletName}`;
    }

    return 'Connect Wallet';
  };

  const getButtonClass = () => {
    const baseClass = 'px-4 py-2 rounded font-medium transition-colors duration-200';
    
    if (isConnecting) {
      return `${baseClass} bg-gray-400 text-white cursor-not-allowed`;
    }

    return `${baseClass} bg-blue-500 hover:bg-blue-600 text-white ${className}`;
  };

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting}
      className={getButtonClass()}
    >
      {getButtonText()}
    </button>
  );
}

export function WalletConnectionStatus() {
  const { 
    connectionStatus, 
    lastAttemptedWallet, 
    availableWallets,
    connectionStates 
  } = useSeamlessWallet();

  if (connectionStatus === 'idle') {
    return null;
  }

  const getStatusMessage = () => {
    switch (connectionStatus) {
      case 'redirecting':
        return `Opening ${lastAttemptedWallet || 'wallet'}...`;
      case 'connecting':
        return `Connecting to ${lastAttemptedWallet || 'wallet'}...`;
      case 'connected':
        return `Connected to ${lastAttemptedWallet || 'wallet'}!`;
      case 'failed':
        return `Failed to connect to ${lastAttemptedWallet || 'wallet'}`;
      default:
        return '';
    }
  };

  const getStatusClass = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className={`p-3 rounded border ${getStatusClass()}`}>
      <p className="text-sm font-medium">{getStatusMessage()}</p>
      
      {availableWallets.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-600">Available wallets:</p>
          <div className="flex gap-2 mt-1">
            {availableWallets.map(wallet => (
              <span 
                key={wallet}
                className={`text-xs px-2 py-1 rounded ${
                  connectionStates[wallet] 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {WALLET_CONFIGS[wallet]?.name || wallet}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 