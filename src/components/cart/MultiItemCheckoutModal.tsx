import React, { useState, useEffect } from 'react';
import { X, ChevronRight, CreditCard, Wallet, Tag, Check } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { OptimizedImage } from '../ui/OptimizedImage';
import { formatPrice } from '../../utils/formatters';
import { useWallet } from '../../contexts/WalletContext';
import { useModal } from '../../contexts/ModalContext';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { toast } from 'react-toastify';
import { Loading, LoadingType } from '../ui/LoadingStates';

interface MultiItemCheckoutModalProps {
  onClose: () => void;
}

export function MultiItemCheckoutModal({ onClose }: MultiItemCheckoutModalProps) {
  const { items, clearCart, verifyAllItems } = useCart();
  const { isConnected, walletAddress } = useWallet();
  const { setVisible } = useWalletModal();
  const { showVerificationModal } = useModal();
  
  // Form state
  const [shipping, setShipping] = useState<{
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    email: string;
    phone: string;
  }>({
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    email: '',
    phone: ''
  });
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    discountPercentage: number;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  
  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'solana' | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Try to load shipping info from localStorage
  useEffect(() => {
    const savedShipping = localStorage.getItem('lastShippingInfo');
    if (savedShipping) {
      try {
        const parsedShipping = JSON.parse(savedShipping);
        setShipping({
          firstName: parsedShipping.firstName || '',
          lastName: parsedShipping.lastName || '',
          address: parsedShipping.address || '',
          city: parsedShipping.city || '',
          state: parsedShipping.state || '',
          zip: parsedShipping.zip || '',
          country: parsedShipping.country || '',
          email: parsedShipping.contactValue || '',
          phone: parsedShipping.phoneNumber || ''
        });
      } catch (error) {
        console.error('Failed to parse saved shipping info:', error);
      }
    }
  }, []);
  
  // Calculate total price of all items in cart
  const totalPrice = items.reduce((total, item) => {
    const basePrice = item.product.price || 0;
    
    // Apply variant price adjustments if any
    let variantPriceAdjustment = 0;
    if (item.product.variants) {
      item.product.variants.forEach(variant => {
        const selectedOptionValue = item.selectedOptions[variant.id];
        if (selectedOptionValue) {
          const selectedOption = variant.options.find(
            option => option.value === selectedOptionValue
          );
          if (selectedOption && selectedOption.priceAdjustment) {
            variantPriceAdjustment += selectedOption.priceAdjustment;
          }
        }
      });
    }
    
    const itemPrice = (basePrice + variantPriceAdjustment) * item.quantity;
    return total + itemPrice;
  }, 0);
  
  // Calculate final price with coupon discount
  const finalPrice = appliedCoupon 
    ? appliedCoupon.discountPercentage 
      ? totalPrice * (1 - appliedCoupon.discountPercentage / 100) 
      : totalPrice - appliedCoupon.discountAmount
    : totalPrice;
  
  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setShipping(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle coupon application
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }
    
    setValidatingCoupon(true);
    
    try {
      // Mock coupon validation - in a real implementation, you'd call your API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulating a valid coupon with 10% off for "CART10"
      if (couponCode.toUpperCase() === 'CART10') {
        setAppliedCoupon({
          code: couponCode.toUpperCase(),
          discountAmount: 0,
          discountPercentage: 10
        });
        toast.success("Coupon applied: 10% off your order");
      } else {
        toast.error("Invalid coupon code");
      }
    } catch (error) {
      toast.error("Error validating coupon");
      console.error("Coupon validation error:", error);
    } finally {
      setValidatingCoupon(false);
    }
  };
  
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast.info("Coupon removed");
  };
  
  const handlePaymentMethodSelect = (method: 'stripe' | 'solana') => {
    setPaymentMethod(method);
  };
  
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const requiredFields = ['firstName', 'lastName', 'address', 'city', 'zip', 'country', 'email'];
    for (const field of requiredFields) {
      if (!shipping[field as keyof typeof shipping]) {
        toast.error(`Please fill in your ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return;
      }
    }
    
    // Verify wallet connection for Solana payments
    if (paymentMethod === 'solana' && !isConnected) {
      setVisible(true);
      return;
    }
    
    // Ensure a payment method is selected
    if (!paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }
    
    setProcessingPayment(true);
    
    try {
      // Verify all items in the cart again just before checkout as a safety measure
      const allItemsVerified = await verifyAllItems(walletAddress);
      
      if (!allItemsVerified) {
        // Find unverified items
        const unverifiedItems = items.filter(item => 
          item.product.category?.eligibilityRules?.groups?.length && 
          (!item.verificationStatus?.verified)
        );
        
        if (unverifiedItems.length > 0) {
          const itemNames = unverifiedItems.map(item => item.product.name).join(', ');
          toast.error(`You don't have access to these items: ${itemNames}. Please remove them from your cart.`);
          setProcessingPayment(false);
          return;
        }
      }
      
      // For Stripe, handle Stripe checkout flow
      if (paymentMethod === 'stripe') {
        // In a real implementation, you'd call your batch order endpoint first to get an order number
        // Then proceed with Stripe checkout
        
        // Example of calling the batch order endpoint
        const batchOrderResponse = await fetch('/.netlify/functions/create-batch-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            items: items.map(item => ({
              product: item.product,
              selectedOptions: item.selectedOptions,
              quantity: item.quantity
            })),
            shippingInfo: {
              address: shipping.address,
              city: shipping.city,
              country: shipping.country,
              state: shipping.state || undefined,
              zip: shipping.zip,
              firstName: shipping.firstName,
              lastName: shipping.lastName,
              email: shipping.email,
              phone: shipping.phone
            },
            walletAddress: walletAddress || 'anonymous',
            paymentMetadata: {
              paymentMethod: 'stripe',
              couponCode: appliedCoupon?.code,
              couponDiscount: appliedCoupon 
                ? (appliedCoupon.discountPercentage 
                  ? (totalPrice * appliedCoupon.discountPercentage / 100) 
                  : appliedCoupon.discountAmount)
                : 0,
              originalPrice: totalPrice
            }
          })
        });
        
        const batchOrderData = await batchOrderResponse.json();
        
        if (!batchOrderData.success) {
          throw new Error(batchOrderData.error || 'Failed to create batch order');
        }
        
        // Store the order information for confirmation
        const orderNumber = batchOrderData.orderNumber;
        
        // Now proceed with Stripe payment using the order number
        // In a real implementation, you'd redirect to Stripe checkout
        // For now, we'll just show a success message
        
        toast.success(`Order #${orderNumber} created! Redirecting to Stripe checkout...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // After successful payment, clear cart
        clearCart();
        onClose();
      }
      // For Solana, use the existing token verification modal
      else if (paymentMethod === 'solana' && items.length > 0) {
        const firstItem = items[0];
        
        // Add the coupon and cart metadata to the payment
        const paymentMetadata = {
          isCartOrder: true,
          cartItemCount: items.length,
          couponCode: appliedCoupon?.code,
          couponDiscount: appliedCoupon 
            ? (appliedCoupon.discountPercentage 
              ? (totalPrice * appliedCoupon.discountPercentage / 100) 
              : appliedCoupon.discountAmount)
            : 0,
          originalPrice: totalPrice
        };
        
        // Format shipping info for the verification modal
        const formattedShippingInfo = {
          address: shipping.address,
          city: shipping.city,
          country: shipping.country,
          state: shipping.state || undefined,
          zip: shipping.zip,
          firstName: shipping.firstName,
          lastName: shipping.lastName,
          email: shipping.email,
          phone: shipping.phone
        };
        
        // Use the existing verification modal with the first item
        showVerificationModal(
          firstItem.product, 
          firstItem.selectedOptions,
          {
            shippingInfo: formattedShippingInfo,
            paymentMetadata
          }
        );
        
        // After successful checkout, clear the cart
        clearCart();
        onClose();
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("An error occurred during checkout");
    } finally {
      setProcessingPayment(false);
    }
  };
  
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-gray-900 w-full max-w-2xl rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Checkout</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-4 max-h-[80vh] overflow-y-auto">
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Order Summary</h3>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-3 bg-gray-800/50 p-2 rounded-lg">
                    <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-900 flex-shrink-0">
                      <OptimizedImage
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h4 className="text-sm font-medium text-white">{item.product.name}</h4>
                        <span className="text-sm text-gray-300">Qty: {item.quantity}</span>
                      </div>
                      {Object.keys(item.selectedOptions).length > 0 && (
                        <div className="mt-1 text-xs text-gray-400">
                          {Object.entries(item.selectedOptions).map(([variantId, optionValue]) => {
                            const variant = item.product.variants?.find(v => v.id === variantId);
                            if (!variant) return null;
                            const option = variant.options.find(o => o.value === optionValue);
                            if (!option) return null;
                            
                            return (
                              <div key={variantId}>
                                {variant.name}: {option.label}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="text-sm text-gray-200 mt-1">
                        {formatPrice(
                          (item.product.price || 0) +
                          (item.product.variants?.reduce((total, variant) => {
                            const selectedOption = variant.options.find(
                              option => option.value === item.selectedOptions[variant.id]
                            );
                            return total + (selectedOption?.priceAdjustment || 0);
                          }, 0) || 0)
                        )} × {item.quantity}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Coupon Section */}
              <div className="mt-4 border-t border-gray-800 pt-4">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-gray-800/70 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-secondary" />
                      <div>
                        <span className="text-sm font-medium text-white">Coupon: {appliedCoupon.code}</span>
                        <p className="text-xs text-gray-400">
                          {appliedCoupon.discountPercentage 
                            ? `${appliedCoupon.discountPercentage}% off` 
                            : formatPrice(appliedCoupon.discountAmount) + ' off'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleRemoveCoupon}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={validatingCoupon || !couponCode.trim()}
                      className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {validatingCoupon ? (
                        <Loading type={LoadingType.ACTION} />
                      ) : (
                        'Apply'
                      )}
                    </button>
                  </div>
                )}
              </div>
              
              {/* Price Summary */}
              <div className="mt-4 border-t border-gray-800 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="text-gray-300">{formatPrice(totalPrice)}</span>
                  </div>
                  
                  {appliedCoupon && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Discount</span>
                      <span className="text-secondary">
                        -{formatPrice(
                          appliedCoupon.discountPercentage 
                            ? totalPrice * (appliedCoupon.discountPercentage / 100) 
                            : appliedCoupon.discountAmount
                        )}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between font-medium pt-2">
                    <span className="text-gray-300">Total</span>
                    <span className="text-lg text-white">{formatPrice(finalPrice)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleCheckout} className="space-y-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Shipping Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-xs text-gray-400 mb-1">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={shipping.firstName}
                    onChange={handleShippingChange}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-xs text-gray-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={shipping.lastName}
                    onChange={handleShippingChange}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="address" className="block text-xs text-gray-400 mb-1">Address</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={shipping.address}
                    onChange={handleShippingChange}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label htmlFor="city" className="block text-xs text-gray-400 mb-1">City</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={shipping.city}
                    onChange={handleShippingChange}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label htmlFor="state" className="block text-xs text-gray-400 mb-1">State/Province</label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={shipping.state}
                    onChange={handleShippingChange}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label htmlFor="zip" className="block text-xs text-gray-400 mb-1">ZIP/Postal Code</label>
                  <input
                    type="text"
                    id="zip"
                    name="zip"
                    value={shipping.zip}
                    onChange={handleShippingChange}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label htmlFor="country" className="block text-xs text-gray-400 mb-1">Country</label>
                  <input
                    type="text"
                    id="country"
                    name="country"
                    value={shipping.country}
                    onChange={handleShippingChange}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs text-gray-400 mb-1">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={shipping.email}
                    onChange={handleShippingChange}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-xs text-gray-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={shipping.phone}
                    onChange={handleShippingChange}
                    required
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
              </div>
              
              {/* Payment Method Selection */}
              <div className="pt-4 border-t border-gray-800 mt-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Payment Method</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    type="button"
                    onClick={() => handlePaymentMethodSelect('stripe')}
                    className={`flex-1 flex items-center justify-between p-3 rounded-lg border ${
                      paymentMethod === 'stripe' 
                        ? 'border-secondary bg-gray-800' 
                        : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800/80'
                    } transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className={`h-5 w-5 ${paymentMethod === 'stripe' ? 'text-secondary' : 'text-gray-400'}`} />
                      <span className={`text-sm ${paymentMethod === 'stripe' ? 'text-white' : 'text-gray-300'}`}>
                        Credit Card
                      </span>
                    </div>
                    {paymentMethod === 'stripe' && (
                      <Check className="h-4 w-4 text-secondary" />
                    )}
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => handlePaymentMethodSelect('solana')}
                    className={`flex-1 flex items-center justify-between p-3 rounded-lg border ${
                      paymentMethod === 'solana' 
                        ? 'border-secondary bg-gray-800' 
                        : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800/80'
                    } transition-colors`}
                  >
                    <div className="flex items-center gap-3">
                      <Wallet className={`h-5 w-5 ${paymentMethod === 'solana' ? 'text-secondary' : 'text-gray-400'}`} />
                      <span className={`text-sm ${paymentMethod === 'solana' ? 'text-white' : 'text-gray-300'}`}>
                        Solana {isConnected ? '(Connected)' : ''}
                      </span>
                    </div>
                    {paymentMethod === 'solana' && (
                      <Check className="h-4 w-4 text-secondary" />
                    )}
                  </button>
                </div>
                
                {paymentMethod === 'solana' && !isConnected && (
                  <p className="mt-2 text-xs text-yellow-400">
                    Please connect your wallet to continue with Solana payment
                  </p>
                )}
              </div>
              
              {/* Checkout button */}
              <div className="pt-4 border-t border-gray-800 mt-4">
                <button
                  type="submit"
                  disabled={processingPayment || (paymentMethod === 'solana' && !isConnected) || !paymentMethod}
                  className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingPayment ? (
                    <Loading type={LoadingType.ACTION} />
                  ) : (
                    <>
                      <span>Continue to Payment</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 