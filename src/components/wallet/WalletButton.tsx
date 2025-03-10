import { Wallet } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export function WalletButton() {
  const { isConnected, walletAddress, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const handleClick = async () => {
    try {
      if (isConnected) {
        await disconnect();
      } else {
        setVisible(true);
      }
    } catch (err) {
      console.error('Wallet action error:', err);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm transition-colors whitespace-nowrap"
      >
        <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span>
          {isConnected ? 
            `${walletAddress?.slice(0, 4)}...${walletAddress?.slice(-4)}` :
            'Connect Wallet'
          }
        </span>
      </button>
    </>
  );
}