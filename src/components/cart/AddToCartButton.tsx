import React, { useState } from 'react';
import { ShoppingCart, Plus, Loader2, Eye } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useWallet } from '../../contexts/WalletContext';
import { isPreviewMode } from '../../utils/preview';
import type { Product } from '../../types/variants';
import { toast } from 'react-toastify';
import { verifyAndAddToCart } from '../../utils/productAccessVerification';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useModifiedPrice } from '../../hooks/useModifiedPrice';
import { getVariantKey } from '../../utils/variant-helpers';

interface AddToCartButtonProps {
  product: Product;
  selectedOptions: Record<string, string>;
  customizationData?: {
    image?: File | null;
    text?: string;
    imagePreview?: string;
    imageBase64?: string;
  };
  disabled?: boolean;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isCustomizationValid?: boolean; // Add this prop to match BuyButton validation
}

export function AddToCartButton({
  product,
  selectedOptions,
  customizationData,
  disabled,
  className = '',
  showText = false,
  size = 'md',
  isCustomizationValid = true
}: AddToCartButtonProps) {
  const { addItem, toggleCart } = useCart();
  const { walletAddress } = useWallet();
  const { setVisible } = useWalletModal();
  const [isVerifying, setIsVerifying] = useState(false);
  const isPreview = isPreviewMode();
  
  // Get the correctly modified price based on product, variants and dynamic pricing
  const { modifiedPrice } = useModifiedPrice({ product, selectedOptions });
  
  const sizeClasses = {
    sm: 'h-3.5 w-3.5',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  // Function to check if all required options are selected
  const areAllOptionsSelected = (): boolean => {
    // Filter out customization variants from regular variants
    const customizationFields = ['Image Customization', 'Text Customization'];
    const regularVariants = product.variants?.filter(variant => !customizationFields.includes(variant.name)) || [];
    
    // Check if all regular variants are selected
    const allRegularVariantsSelected = regularVariants.length === 0 || 
      regularVariants.every(variant => selectedOptions[variant.id]);
    
    // Determine final validation based on customization requirements
    if (product.isCustomizable === 'mandatory') {
      // For mandatory customization, also require customization to be valid
      return allRegularVariantsSelected && isCustomizationValid;
    } else if (product.isCustomizable === 'optional') {
      // For optional customization, only require regular variants
      return allRegularVariantsSelected;
    }
    // For 'no' customization, only regular variants matter
    return allRegularVariantsSelected;
  };
  
  // Function to get price adjustments from variant options
  const getVariantPriceAdjustments = (): number => {
    if (!product.variants) return 0;
    
    return product.variants.reduce((total, variant) => {
      const selectedOptionValue = selectedOptions[variant.id];
      if (selectedOptionValue) {
        const selectedOption = variant.options.find(
          option => option.value === selectedOptionValue
        );
        if (selectedOption && selectedOption.priceAdjustment) {
          return total + selectedOption.priceAdjustment;
        }
      }
      return total;
    }, 0);
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!areAllOptionsSelected()) {
      toast.error('Please select all options before adding to cart');
      return;
    }
    
    // Check if wallet is connected first
    if (!walletAddress) {
      toast.info("Please connect your wallet to add items to cart", {
        position: "bottom-center",
        autoClose: 3000
      });
      
      // Show wallet connection modal
      setVisible(true);
      return;
    }
    
    // Prepare pricing information
    const variantKey = product.variants ? getVariantKey(product.variants, selectedOptions) : null;
    const priceInfo = {
      basePrice: product.price,
      modifiedPrice,
      variantKey,
      variantPriceAdjustments: getVariantPriceAdjustments()
    };
    
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
          () => setVisible(true), // Function to show wallet connection modal if needed
          priceInfo,
          toggleCart,  // Pass toggle cart function for the View link
          customizationData
        );
      } catch (error) {
        console.error('Error verifying product access:', error);
        toast.error('There was an error verifying access to this product');
      } finally {
        setIsVerifying(false);
      }
    } else {
      // No access restrictions, but still use the verification flow for consistent toast handling
      try {
        await verifyAndAddToCart(
          product, 
          walletAddress,
          addItem,
          selectedOptions,
          1,
          () => setVisible(true),
          priceInfo,
          toggleCart,
          customizationData
        );
      } catch (error) {
        console.error('Error adding to cart:', error);
        toast.error('There was an error adding the product to cart');
      }
    }
  };

  // If in preview mode, show preview button
  if (isPreview) {
    return (
      <button
        disabled
        className={`flex items-center justify-center gap-1 bg-gray-600/30 backdrop-blur-sm text-gray-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-500/30 ${className}`}
        aria-label="Preview mode"
      >
        <Eye className={sizeClasses[size]} />
        {showText && <span>Preview</span>}
      </button>
    );
  }

  return (
    <button
      onClick={handleAddToCart}
      disabled={disabled || isVerifying || !areAllOptionsSelected()}
      className={`flex items-center justify-center gap-1 bg-secondary hover:bg-secondary-hover text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
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