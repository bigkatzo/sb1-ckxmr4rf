import React from 'react';
import { useWallet } from '../../contexts/WalletContext';

interface ConnectWalletButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function ConnectWalletButton({ className = '', children }: ConnectWalletButtonProps) {
  const { 
    toggleConnect, 
    forceDisconnect,
    isConnected, 
    walletAddress, 
    authenticated,
    user,
    error 
  } = useWallet();

  const handleClick = async () => {
    try {
      await toggleConnect();
    } catch (error) {
      console.error('Wallet connection error:', error);
    }
  };

  const handleForceDisconnect = async () => {
    try {
      await forceDisconnect();
    } catch (error) {
      console.error('Force disconnect error:', error);
    }
  };

  const getButtonText = () => {
    if (children) return children;
    
    if (isConnected && walletAddress) {
      return `Disconnect ${walletAddress.substring(0, 4)}...${walletAddress.substring(-4)}`;
    }
    
    if (authenticated && !isConnected) {
      return 'Reconnect Wallet';
    }
    
    return 'Connect Wallet';
  };

  const getButtonClass = () => {
    const baseClass = 'px-4 py-2 rounded-lg font-medium transition-colors duration-200';
    
    if (isConnected) {
      return `${baseClass} bg-red-600 hover:bg-red-700 text-white ${className}`;
    }
    
    return `${baseClass} bg-blue-600 hover:bg-blue-700 text-white ${className}`;
  };

  // Check if connected to wrong chain
  const isWrongChain = user?.wallet && (
    (user.wallet.chainId?.toString() !== 'solana' && user.wallet.chainId?.toString() !== '7565164') || 
    user.wallet.chainType !== 'solana'
  );

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={handleClick}
        className={getButtonClass()}
        disabled={false}
      >
        {getButtonText()}
      </button>
      
      {isWrongChain && (
        <div className="text-yellow-500 text-sm max-w-xs text-center bg-yellow-900 p-2 rounded">
          ⚠️ Wrong Network: Connected to {user.wallet.chainType} (Chain ID: {user.wallet.chainId})
          <br />
          <button
            onClick={handleForceDisconnect}
            className="text-blue-400 underline mt-1"
          >
            Force Disconnect & Reconnect
          </button>
        </div>
      )}
      
      {error && (
        <div className="text-red-500 text-sm max-w-xs text-center">
          {error.message}
        </div>
      )}
      
      {isConnected && walletAddress && !isWrongChain && (
        <div className="text-green-500 text-sm">
          ✅ Connected: {walletAddress.substring(0, 8)}...{walletAddress.substring(-8)}
        </div>
      )}
    </div>
  );
} 