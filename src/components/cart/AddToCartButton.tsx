import React, { useState } from 'react';
import { ShoppingCart, Plus, Loader2 } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useWallet } from '../../contexts/WalletContext';
import type { Product } from '../../types/variants';
import { toast } from 'react-toastify';
import { verifyAndAddToCart } from '../../utils/productAccessVerification';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

interface AddToCartButtonProps {
  product: Product;
  selectedOptions: Record<string, string>;
  disabled?: boolean;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function AddToCartButton({
  product,
  selectedOptions,
  disabled,
  className = '',
  showText = false,
  size = 'md'
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const { walletAddress } = useWallet();
  const { setVisible } = useWalletModal();
  const [isVerifying, setIsVerifying] = useState(false);
  
  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  // Function to check if all required options are selected
  const areAllOptionsSelected = (): boolean => {
    if (!product.variants || product.variants.length === 0) return true;
    
    return product.variants.every(variant => selectedOptions[variant.id]);
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!areAllOptionsSelected()) {
      toast.error('Please select all options before adding to cart');
      return;
    }
    
    // Check if the product has access restrictions before adding to cart
    if (product.category?.eligibilityRules?.groups?.length) {
      setIsVerifying(true);
      
      try {
        await verifyAndAddToCart(
          product, 
          walletAddress,
          addItem,
          selectedOptions,
          1,
          () => setVisible(true) // Function to show wallet connection modal if needed
        );
      } catch (error) {
        console.error('Error verifying product access:', error);
        toast.error('There was an error verifying access to this product');
      } finally {
        setIsVerifying(false);
      }
    } else {
      // No access restrictions, directly add to cart
      addItem(product, selectedOptions);
      
      // Show success toast
      toast.success(`${product.name} added to cart`, {
        position: 'bottom-center',
        autoClose: 2000,
        hideProgressBar: true
      });
    }
  };

  return (
    <button
      onClick={handleAddToCart}
      disabled={disabled || isVerifying || !areAllOptionsSelected()}
      className={`flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      aria-label="Add to cart"
    >
      {isVerifying ? (
        <Loader2 className={`${sizeClasses[size]} animate-spin`} />
      ) : (
        <div className="relative">
          <ShoppingCart className={sizeClasses[size]} />
          <Plus className="absolute -right-1 -top-1 h-2.5 w-2.5" />
        </div>
      )}
      {showText && <span>{isVerifying ? 'Verifying...' : 'Add to Cart'}</span>}
    </button>
  );
} 