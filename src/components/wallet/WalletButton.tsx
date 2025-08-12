import { Wallet, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { WalletModal } from './WalletModal';

export function WalletButton() {
  const { isConnected, walletAddress, connect, embeddedWalletAddress } = useWallet();
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = async () => {
    try {
      if (isConnected) {
        // If connected, open the wallet modal instead of disconnecting
        console.log('Opening wallet modal...'); // Debug log
        setIsModalOpen(true);
      } else {
        // If not connected, connect the wallet
        await connect();
      }
    } catch (err) {
      console.error('Wallet action error:', err);
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

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleClick}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm transition-colors whitespace-nowrap"
        >
          <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>
            {isConnected ? 
              `${walletAddress?.slice(0, 4)}...${walletAddress?.slice(-4)}` :
              'Connect Wallet'
            }
          </span>
        </button>
        
        {isConnected && (walletAddress || embeddedWalletAddress) && (
          <button
            onClick={handleCopyAddress}
            className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1.5 sm:px-3 sm:py-2 rounded-full text-xs sm:text-sm transition-colors"
            title="Copy wallet address"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
            <span className="hidden sm:inline">
              {copied ? 'Copied!' : 'Copy'}
            </span>
          </button>
        )}
      </div>

      {/* Debug info */}
      {console.log('WalletButton: isModalOpen =', isModalOpen)}

      {/* Wallet Modal */}
      <WalletModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}