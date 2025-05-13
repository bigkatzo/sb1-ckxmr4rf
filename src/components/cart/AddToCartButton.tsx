import React from 'react';
import { ShoppingCart, Plus } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import type { Product } from '../../types/variants';
import { toast } from 'react-toastify';

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

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!areAllOptionsSelected()) {
      toast.error('Please select all options before adding to cart');
      return;
    }
    
    addItem(product, selectedOptions);
    
    // Show success toast
    toast.success(`${product.name} added to cart`, {
      position: 'bottom-center',
      autoClose: 2000,
      hideProgressBar: true
    });
  };

  return (
    <button
      onClick={handleAddToCart}
      disabled={disabled || !areAllOptionsSelected()}
      className={`flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      aria-label="Add to cart"
    >
      <div className="relative">
        <ShoppingCart className={sizeClasses[size]} />
        <Plus className="absolute -right-1 -top-1 h-2.5 w-2.5" />
      </div>
      {showText && <span>Add to Cart</span>}
    </button>
  );
} 