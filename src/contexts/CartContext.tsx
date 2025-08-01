import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product } from '../types/variants';
import { verifyProductAccess } from '../utils/productAccessVerification';
import { calculateTotalPrice } from '../utils/currencyUtils';

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
  customizationData?: {
    image?: File | null;
    text?: string;
    imagePreview?: string;
    imageBase64?: string;
  };
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
    priceInfo?: CartItemPriceInfo,
    customizationData?: {
      image?: File | null;
      text?: string;
      imagePreview?: string;
      imageBase64?: string;
    }
  ) => void;
  removeItem: (itemIndex: number) => void;
  updateQuantity: (itemIndex: number, quantity: number) => void;
  clearCart: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  count: number;
  getTotalPrice: (currency: string, solRate: number) => number;
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
      // Debug cart contents
      console.log('Cart contents before saving:', JSON.stringify(items, null, 2));
      
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      
      // Check if variants are preserved after serialization
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        console.log('Cart contents after loading from localStorage:');
        parsedCart.forEach((item: CartItem, index: number) => {
          console.log(`Item ${index}: ${item.product.name}`);
          console.log('Selected options:', item.selectedOptions);
          console.log('Has variants array:', !!item.product.variants);
          if (item.product.variants) {
            console.log('Variants count:', item.product.variants.length);
            item.product.variants.forEach((v, i) => {
              console.log(`Variant ${i}: ${v.name}, Options:`, v.options?.length || 0);
            });
          }
        });
      }
      
      // Update count
      setCount(items.reduce((total, item) => total + item.quantity, 0));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }, [items]);

// Calculate total price of all items in the cart in the desired currency
const getTotalPrice = (currency: string = 'SOL', solRate: number = 180): number => {
  return calculateTotalPrice(items, currency, solRate);
};

  const addItem = (
    product: Product, 
    selectedOptions: Record<string, string>, 
    quantity = 1,
    verified = false,
    priceInfo?: CartItemPriceInfo,
    customizationData?: {
      image?: File | null;
      text?: string;
      imagePreview?: string;
      imageBase64?: string;
    }
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

      // Create a deep clone to ensure all nested properties are preserved
      const deepCloneProduct = () => {
        // First do a stringify/parse to get a basic deep clone
        const productCopy = JSON.parse(JSON.stringify(product));
        
        // Make sure variants array is defined
        if (!productCopy.variants) {
          productCopy.variants = [];
        }
        
        // Make sure each variant has its options with complete data
        if (productCopy.variants && Array.isArray(productCopy.variants)) {
          productCopy.variants = productCopy.variants.map((variant: any) => {
            if (!variant.options) {
              variant.options = [];
            }
            return variant;
          });
        }
        
        // Log to verify variant data is correct
        console.log("Adding to cart with variants:", productCopy.variants);
        
        return productCopy;
      };
      
      // Clone the product with full variant information
      const clonedProduct = deepCloneProduct();

      if (existingItemIndex !== -1) {
        // Update quantity of existing item
        const newItems = [...prevItems];
        newItems[existingItemIndex].quantity += quantity;
        // Also update price info in case it changed
        newItems[existingItemIndex].priceInfo = defaultPriceInfo;
        // Preserve variant data in case it was updated
        newItems[existingItemIndex].product = clonedProduct;
        return newItems;
      } else {
        // Add new item with verification status if verified
        const newItem: CartItem = { 
          product: clonedProduct, 
          selectedOptions, 
          quantity,
          priceInfo: defaultPriceInfo,
          ...(verified && {
            verificationStatus: {
              verified: true,
              timestamp: Date.now()
            }
          }),
          customizationData
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