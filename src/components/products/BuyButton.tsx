import type { MouseEvent } from 'react';
import { ShoppingBag, Clock, Ban } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useModal } from '../../contexts/ModalContext';
import { useOrderStats } from '../../hooks/useOrderStats';
import type { Product } from '../../types/variants';

interface BuyButtonProps {
  product: Product;
  selectedOptions?: Record<string, string>;
  disabled?: boolean;
  className?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  showModal?: boolean;
}

export function BuyButton({ 
  product, 
  selectedOptions = {}, 
  disabled, 
  className = '', 
  onClick,
  showModal = false
}: BuyButtonProps) {
  const { isConnected } = useWallet();
  const { setVisible } = useWalletModal();
  const { showVerificationModal } = useModal();
  const { currentOrders } = useOrderStats(product.id);

  // Check if collection is not live yet or sale has ended at any level
  const isUpcoming = product.collectionLaunchDate ? new Date(product.collectionLaunchDate) > new Date() : false;
  const isSaleEnded = product.saleEnded || product.categorySaleEnded || product.collectionSaleEnded;
  const isUnlimited = product.stock === null;
  const isSoldOut = !isUnlimited && (
    product.stock === 0 || // No stock available
    (typeof currentOrders === 'number' && currentOrders >= (product.stock as number)) // Current orders reached or exceeded stock limit
  );

  const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent event bubbling

    try {
      // If wallet not connected, show wallet modal
      if (!isConnected) {
        setVisible(true);
        return;
      }

      // If in modal view, handle verification and payment
      if (showModal) {
        showVerificationModal(product, selectedOptions);
      } else if (onClick) {
        // If not in modal, trigger the onClick handler (to open modal)
        onClick(e);
      }
    } catch (error) {
      console.error('Buy error:', error);
    }
  };

  // If sale has ended, show ended button
  if (isSaleEnded) {
    return (
      <button 
        disabled
        className={`
          flex items-center gap-1 bg-red-900/20 backdrop-blur-sm
          text-red-400 px-1.5 py-1 sm:px-2 sm:py-1.5 rounded text-[10px] sm:text-xs 
          cursor-not-allowed transition-colors
          ${className}
        `}
      >
        <Ban className="h-3 w-3" />
        <span>Ended</span>
      </button>
    );
  }

  // If collection is not live yet, show coming soon button
  if (isUpcoming) {
    return (
      <button 
        disabled
        className={`
          flex items-center gap-1 bg-gray-800/80 backdrop-blur-sm
          text-gray-400 px-1.5 py-1 sm:px-2 sm:py-1.5 rounded text-[10px] sm:text-xs 
          cursor-not-allowed transition-colors
          ${className}
        `}
      >
        <Clock className="h-3 w-3" />
        <span>Soon</span>
      </button>
    );
  }

  // If product is sold out, show sold out button
  if (isSoldOut) {
    return (
      <button 
        disabled
        className={`
          flex items-center gap-1 bg-red-900/20 backdrop-blur-sm
          text-red-400 px-1.5 py-1 sm:px-2 sm:py-1.5 rounded text-[10px] sm:text-xs 
          cursor-not-allowed transition-colors
          ${className}
        `}
      >
        <Ban className="h-3 w-3" />
        <span>Sold Out</span>
      </button>
    );
  }

  return (
    <button 
      onClick={handleClick}
      disabled={disabled}
      className={`
        flex items-center gap-1 bg-primary hover:bg-primary-hover 
        text-white px-1.5 py-1 sm:px-2 sm:py-1.5 rounded text-[10px] sm:text-xs transition-colors 
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      <ShoppingBag className="h-3 w-3" />
      <span>
        {!isConnected ? 'Connect' : showModal ? 'Buy' : 'Buy'}
      </span>
    </button>
  );
}