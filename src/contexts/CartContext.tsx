import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product } from '../types/variants';
import { verifyProductAccess } from '../utils/productAccessVerification';

// Interface for price information
export interface CartItemPriceInfo {
  basePrice: number;
  modifiedPrice: number;
  variantKey: string | null;
  variantPriceAdjustments: number;
}

export interface CartItem {
  product: Product;
  selectedOptions: Record<string, string>;
  quantity: number;
  priceInfo: CartItemPriceInfo;
  verificationStatus?: {
    verified: boolean;
    timestamp: number;
    error?: string;
  };
}

interface CartContextType {
  items: CartItem[];
  addItem: (
    product: Product, 
    selectedOptions: Record<string, string>, 
    quantity?: number, 
    verified?: boolean,
    priceInfo?: CartItemPriceInfo
  ) => void;
  removeItem: (itemIndex: number) => void;
  updateQuantity: (itemIndex: number, quantity: number) => void;
  clearCart: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  count: number;
  getTotalPrice: () => number;
  verifyAllItems: (walletAddress: string | null) => Promise<boolean>;
}

const CartContext = createContext<CartContextType>({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  isOpen: false,
  openCart: () => {},
  closeCart: () => {},
  toggleCart: () => {},
  count: 0,
  getTotalPrice: () => 0,
  verifyAllItems: async () => false
});

const CART_STORAGE_KEY = 'store_cart';
// 1 hour in milliseconds - after this time, verification expires
const VERIFICATION_EXPIRY = 60 * 60 * 1000;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [count, setCount] = useState(0);

  // Load cart from localStorage on initial render
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setItems(parsedCart);
        // Calculate total count
        setCount(parsedCart.reduce((total: number, item: CartItem) => total + item.quantity, 0));
      }
    } catch (error) {
      console.error('Failed to load cart from localStorage:', error);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      // Update count
      setCount(items.reduce((total, item) => total + item.quantity, 0));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }, [items]);

  // Calculate total price of all items in cart
  const getTotalPrice = (): number => {
    return items.reduce((total, item) => {
      const itemPrice = item.priceInfo?.modifiedPrice || item.product.price;
      return total + (itemPrice * item.quantity);
    }, 0);
  };

  const addItem = (
    product: Product, 
    selectedOptions: Record<string, string>, 
    quantity = 1,
    verified = false,
    priceInfo?: CartItemPriceInfo
  ) => {
    setItems(prevItems => {
      // Check if this exact product + options combination already exists in cart
      const existingItemIndex = prevItems.findIndex(item =>
        item.product.id === product.id &&
        JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions)
      );

      // Default price info if not provided
      const defaultPriceInfo: CartItemPriceInfo = priceInfo || {
        basePrice: product.price,
        modifiedPrice: product.price,
        variantKey: null,
        variantPriceAdjustments: 0
      };

      if (existingItemIndex !== -1) {
        // Update quantity of existing item
        const newItems = [...prevItems];
        newItems[existingItemIndex].quantity += quantity;
        // Also update price info in case it changed
        newItems[existingItemIndex].priceInfo = defaultPriceInfo;
        return newItems;
      } else {
        // Add new item with verification status if verified
        const newItem: CartItem = { 
          product, 
          selectedOptions, 
          quantity,
          priceInfo: defaultPriceInfo,
          ...(verified && {
            verificationStatus: {
              verified: true,
              timestamp: Date.now()
            }
          })
        };
        return [...prevItems, newItem];
      }
    });
  };

  const removeItem = (itemIndex: number) => {
    setItems(prevItems => prevItems.filter((_, index) => index !== itemIndex));
  };

  const updateQuantity = (itemIndex: number, quantity: number) => {
    if (quantity < 1) return;
    
    setItems(prevItems => {
      const newItems = [...prevItems];
      if (newItems[itemIndex]) {
        newItems[itemIndex].quantity = quantity;
      }
      return newItems;
    });
  };

  const clearCart = () => {
    setItems([]);
  };

  const openCart = () => {
    setIsOpen(true);
    // Lock body scroll
    document.body.style.overflow = 'hidden';
  };

  const closeCart = () => {
    setIsOpen(false);
    // Unlock body scroll
    document.body.style.overflow = '';
  };

  const toggleCart = () => {
    if (isOpen) {
      closeCart();
    } else {
      openCart();
    }
  };

  // New function to verify all items in the cart before checkout
  const verifyAllItems = async (walletAddress: string | null): Promise<boolean> => {
    if (!walletAddress) {
      return false;
    }
    
    // Create a copy of the items array to update
    const updatedItems = [...items];
    let allVerified = true;
    
    // Check each item in cart
    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      
      // Skip items without access restrictions
      if (!item.product.category?.eligibilityRules?.groups?.length) {
        updatedItems[i] = {
          ...item,
          verificationStatus: {
            verified: true,
            timestamp: Date.now()
          }
        };
        continue;
      }
      
      // Check if current verification is still valid
      const currentTime = Date.now();
      const isVerificationValid = item.verificationStatus?.verified &&
        (currentTime - (item.verificationStatus?.timestamp || 0)) < VERIFICATION_EXPIRY;
      
      if (isVerificationValid) {
        continue; // Skip reverification if current verification is still valid
      }
      
      // Verify the item
      try {
        const result = await verifyProductAccess(item.product, walletAddress);
        
        // Update the item's verification status
        updatedItems[i] = {
          ...item,
          verificationStatus: {
            verified: result.isValid,
            timestamp: currentTime,
            error: result.error
          }
        };
        
        if (!result.isValid) {
          allVerified = false;
        }
      } catch (error) {
        console.error(`Error verifying item ${i}:`, error);
        updatedItems[i] = {
          ...item,
          verificationStatus: {
            verified: false,
            timestamp: currentTime,
            error: error instanceof Error ? error.message : 'Unknown error during verification'
          }
        };
        allVerified = false;
      }
    }
    
    // Update the items state with new verification statuses
    setItems(updatedItems);
    
    return allVerified;
  };

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      isOpen,
      openCart,
      closeCart,
      toggleCart,
      count,
      getTotalPrice,
      verifyAllItems
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext); 