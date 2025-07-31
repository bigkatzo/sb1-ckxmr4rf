import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Wallet, ChevronRight, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useWallet } from '../../contexts/WalletContext';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { formatPriceWithRate } from '../../utils/formatters';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useSolanaPrice } from '../../utils/price-conversion';
import { MultiItemCheckoutModal } from './MultiItemCheckoutModal';
import { OptimizedImage } from '../ui/OptimizedImage';
import { toast } from 'react-toastify';

export function CartDrawer() {
  const { 
    items, 
    removeItem, 
    updateQuantity, 
    isOpen, 
    closeCart, 
    count, 
    getTotalPrice 
  } = useCart();
  
  const { isConnected } = useWallet();
  const { setVisible: showWalletModal } = useWalletModal();
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  
  // Use the getTotalPrice function from the cart context
  const { currency } = useCurrency();
  const { price: solRate } = useSolanaPrice();
  const totalPrice = getTotalPrice(currency, solRate ?? 180);

  const handleCheckout = () => {
    // Check if wallet is connected first
    if (!isConnected) {
      toast.info("Please connect your wallet to proceed with checkout", {
        position: "bottom-center",
        autoClose: 3000
      });
      
      // Show wallet connection modal
      showWalletModal(true);
      return;
    }
    
    // Wallet is connected, proceed with checkout
    setIsCheckoutModalOpen(true);
    // Close the cart drawer after a small delay to ensure the modal is properly opened first
    setTimeout(() => {
      closeCart();
    }, 50);
  };

  return (
    <>
      {/* Cart Drawer UI */}
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm cart-backdrop" onClick={closeCart}></div>
          
          <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[450px] bg-gray-900 shadow-xl cart-content flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart {count > 0 && `(${count})`}
              </h2>
              <button
                onClick={closeCart}
                className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                aria-label="Close cart"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center">
                  <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
                  <p className="mb-2">Your cart is empty</p>
                  <button
                    onClick={closeCart}
                    className="text-secondary hover:underline"
                  >
                    Continue shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div
                      key={`${item.product.id}-${JSON.stringify(item.selectedOptions)}`}
                      className="bg-gray-800/50 rounded-lg p-3 flex gap-3"
                    >
                      <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-gray-900">
                        <OptimizedImage
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <h3 className="font-medium text-white truncate pr-2">{item.product.name}</h3>
                          <button
                            onClick={() => removeItem(index)}
                            className="text-gray-400 hover:text-red-400 transition-colors"
                            aria-label="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {/* Debug button - only in development */}
                        {process.env.NODE_ENV !== 'production' && (
                          <button
                            onClick={() => {
                              console.log('Item debug:', item);
                              console.log('Product:', item.product);
                              console.log('Selected options:', item.selectedOptions);
                              console.log('Variants:', item.product.variants);
                              if (item.product.variants) {
                                item.product.variants.forEach((v, i) => {
                                  console.log(`Variant ${i}:`, v);
                                  if (v.options) {
                                    console.log(`Options for variant ${i}:`, v.options);
                                  } else {
                                    console.log(`No options found for variant ${i}`);
                                  }
                                });
                              }
                              
                              // Try to find the selected options manually
                              Object.entries(item.selectedOptions).forEach(([variantId, optionValue]) => {
                                console.log(`Finding data for variant ID ${variantId} with selected value ${optionValue}`);
                                const foundVariant = item.product.variants?.find(v => v.id === variantId);
                                console.log('Found variant:', foundVariant);
                                if (foundVariant) {
                                  const foundOption = foundVariant.options?.find(o => o.value === optionValue);
                                  console.log('Found option:', foundOption);
                                }
                              });
                            }}
                            className="text-xs text-blue-500 hover:text-blue-400 mt-1"
                          >
                            Debug
                          </button>
                        )}
                        
                        {/* Show selected options */}
                        {Object.keys(item.selectedOptions).length > 0 && (
                          <div className="mt-1 text-xs text-gray-400">
                            {Object.entries(item.selectedOptions).map(([variantId, optionValue]) => {
                              // Find the variant name
                              const variant = item.product.variants?.find(v => v.id === variantId);
                              
                              if (!variant) {
                                return (
                                  <div key={variantId} className="flex">
                                    <span className="font-medium">Option:</span>
                                    <span className="ml-1">{optionValue}</span>
                                  </div>
                                );
                              }
                              
                              // Find the option label
                              const option = variant.options?.find(o => o.value === optionValue);
                              
                              if (!option) {
                                return (
                                  <div key={variantId} className="flex">
                                    <span className="font-medium">{variant.name}:</span>
                                    <span className="ml-1">{optionValue}</span>
                                  </div>
                                );
                              }
                              
                              return (
                                <div key={variantId} className="flex">
                                  <span className="font-medium">{variant.name}:</span>
                                  <span className="ml-1">{option.label || optionValue}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Show customization data */}
                        {item.customizationData && (
                          <div className="mt-1 text-xs text-blue-400">
                            {item.customizationData.text && (
                              <div className="flex">
                                <span className="font-medium">Custom Text:</span>
                                <span className="ml-1 truncate">{item.customizationData.text}</span>
                              </div>
                            )}
                            {item.customizationData.image && (
                              <div className="flex">
                                <span className="font-medium">Custom Image:</span>
                                <span className="ml-1">✓ Added</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center border border-gray-700 rounded-md overflow-hidden">
                            <button
                              onClick={() => updateQuantity(index, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="px-2 text-sm text-gray-300">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(index, item.quantity + 1)}
                              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          
                          <div className="text-white">
                            {formatPriceWithRate(
                              (item.priceInfo?.modifiedPrice || item.product.price) * item.quantity, currency, item.product.baseCurrency, solRate ?? 180
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {items.length > 0 && (
              <div className="p-4 border-t border-gray-800">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-300">Total</span>
                  <span className="text-xl font-medium text-white">
                    {formatPriceWithRate(totalPrice, currency, currency, solRate ?? 180)}
                  </span>
                </div>
                
                <button
                  onClick={handleCheckout}
                  className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {!isConnected ? (
                    <>
                      <Wallet className="h-4 w-4" />
                      <span>Connect Wallet</span>
                    </>
                  ) : (
                    <>
                      <span>Checkout</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Checkout Modal - Rendered outside of cart drawer so it can stay open when cart is closed */}
      {isCheckoutModalOpen && (
        <MultiItemCheckoutModal
          onClose={() => setIsCheckoutModalOpen(false)}
          isSingle={false}
          singleItem={[]}
        />
      )}
    </>
  );
} 