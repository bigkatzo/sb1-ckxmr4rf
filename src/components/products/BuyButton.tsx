import React, { useState } from 'react';
import { ShoppingBag, Clock, Ban } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useModal } from '../../contexts/ModalContext';
import { useOrderStats } from '../../hooks/useOrderStats';
import type { Product } from '../../types';

interface BuyButtonProps {
  product: Product;
  selectedOptions?: Record<string, string>;
  disabled?: boolean;
  className?: string;
  showModal?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function BuyButton({ 
  product, 
  selectedOptions = {}, 
  disabled, 
  className = '', 
  showModal = false,
  onClick 
}: BuyButtonProps) {
  const { isConnected } = useWallet();
  const { setVisible } = useWalletModal();
  const { showVerificationModal } = useModal();
  const { currentOrders } = useOrderStats(product.id);
  const [isLoading, setIsLoading] = useState(false);

  // Check if collection is not live yet or sale has ended
  const isUpcoming = product.collectionLaunchDate ? new Date(product.collectionLaunchDate) > new Date() : false;
  const isSaleEnded = product.collectionSaleEnded;

  // Determine if button should be disabled
  const isDisabled = disabled || isLoading || (
    product.stock !== null && // Only check stock if it's not unlimited
    typeof currentOrders === 'number' && // Make sure we have valid order count
    currentOrders >= product.stock // Check if orders reached or exceeded stock
  );

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent event bubbling
    
    if (onClick) {
      onClick(e);
      return;
    }

    setIsLoading(true);
    try {
      // If wallet not connected, show wallet modal
      if (!isConnected) {
        setVisible(true);
        return;
      }

      // Show verification modal for purchase
      showVerificationModal(product, selectedOptions);
    } catch (error) {
      console.error('Buy error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isUpcoming) {
    return (
      <button 
        disabled
        className={`
          flex items-center gap-1 bg-gray-700 cursor-not-allowed rounded-lg px-3 py-1.5 text-sm
          ${className}
        `}
      >
        <Clock className="h-3 w-3" />
        <span>Coming Soon</span>
      </button>
    );
  }

  if (isSaleEnded) {
    return (
      <button 
        disabled
        className={`
          flex items-center gap-1 bg-red-900/20 text-red-400 cursor-not-allowed rounded-lg px-3 py-1.5 text-sm
          ${className}
        `}
      >
        <Ban className="h-3 w-3" />
        <span>Sale Ended</span>
      </button>
    );
  }

  return (
    <button 
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        flex items-center gap-1 bg-purple-600 hover:bg-purple-700 
        disabled:bg-gray-700 disabled:cursor-not-allowed text-white
        rounded-lg px-3 py-1.5 text-sm
        ${className}
      `}
    >
      <ShoppingBag className="h-3 w-3" />
      {isLoading ? (
        <span>Processing...</span>
      ) : (
        <span>
          {!isConnected ? 'Connect' : 'Buy'}
        </span>
      )}
    </button>
  );
}