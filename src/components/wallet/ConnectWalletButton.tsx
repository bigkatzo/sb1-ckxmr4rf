import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
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
    embeddedWalletAddress,
    authenticated,
    user,
    error 
  } = useWallet();
  
  const [copied, setCopied] = useState(false);

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

  const handleCopyAddress = async () => {
    const addressToCopy = walletAddress || embeddedWalletAddress;
    if (!addressToCopy) return;

    try {
      await navigator.clipboard.writeText(addressToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = addressToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
      <div className="flex items-center gap-2">
        <button
          onClick={handleClick}
          className={getButtonClass()}
          disabled={false}
        >
          {getButtonText()}
        </button>
        
        {isConnected && (walletAddress || embeddedWalletAddress) && (
          <button
            onClick={handleCopyAddress}
            className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-2 rounded-lg text-sm transition-colors"
            title="Copy wallet address"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {copied ? 'Copied!' : 'Copy'}
            </span>
          </button>
        )}
      </div>
      
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