import React from 'react';
import { useWallet } from '../../contexts/WalletContext';

interface ConnectWalletButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function ConnectWalletButton({ className = '', children }: ConnectWalletButtonProps) {
  const { 
    toggleConnect, 
    isConnected, 
    walletAddress, 
    authenticated,
    error 
  } = useWallet();

  const handleClick = async () => {
    try {
      await toggleConnect();
    } catch (error) {
      console.error('Wallet connection error:', error);
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

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={handleClick}
        className={getButtonClass()}
        disabled={false}
      >
        {getButtonText()}
      </button>
      
      {error && (
        <div className="text-red-500 text-sm max-w-xs text-center">
          {error.message}
        </div>
      )}
      
      {isConnected && walletAddress && (
        <div className="text-green-500 text-sm">
          ✅ Connected: {walletAddress.substring(0, 8)}...{walletAddress.substring(-8)}
        </div>
      )}
    </div>
  );
} 