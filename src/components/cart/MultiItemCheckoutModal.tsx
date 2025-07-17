import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronRight, CreditCard, Wallet, Tag, Check, AlertTriangle } from 'lucide-react';
import { useCart, CartItem } from '../../contexts/CartContext';
import { OptimizedImage } from '../ui/OptimizedImage';
import { formatPrice } from '../../utils/formatters';
import { useWallet } from '../../contexts/WalletContext';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { toast } from 'react-toastify';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { CouponService } from '../../services/coupons';
import { validatePhoneNumber, validateZipCode, getStateFromZipCode } from '../../lib/validation';
import { countries, getStatesByCountryCode } from '../../data/countries';
import { ComboBox } from '../ui/ComboBox';
import { getLocationFromZip, doesCountryRequireTaxId } from '../../utils/addressUtil';
// import { usePayment } from '../../hooks/usePayment';
import { StripePaymentModal } from '../products/StripePaymentModal';
import { verifyFinalTransaction } from '../../utils/transaction-monitor.tsx';
import { updateOrderTransactionSignature, getOrderDetails } from '../../services/orders';
import { Button } from '../ui/Button';
import { OrderSuccessView } from '../OrderSuccessView';
// import { create, set } from 'lodash';
import { CryptoPaymentModal } from '../products/CryptoPaymentModal.tsx';

interface MultiItemCheckoutModalProps {
  onClose: () => void;
}

export function MultiItemCheckoutModal({ onClose }: MultiItemCheckoutModalProps) {
  const { items, clearCart, verifyAllItems } = useCart();
  const { isConnected, walletAddress } = useWallet();
  const { setVisible } = useWalletModal();
  
  // Form state
  const [shipping, setShipping] = useState<{
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    contactMethod: string;
    contactValue: string;
    phoneNumber: string;
    taxId?: string;
  }>({
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    contactMethod: 'email',
    contactValue: '',
    phoneNumber: '',
    taxId: ''
  });
  
  // Add validation states
  const [zipError, setZipError] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  
  // Get states for the selected country
  const availableStates = useMemo(() => {
    const countryCode = countries.find(c => c.name === shipping.country)?.code;
    return countryCode ? getStatesByCountryCode(countryCode) : [];
  }, [shipping.country]);
  
  // Check if the selected country requires a tax ID
  const requiresTaxId = useMemo(() => {
    return doesCountryRequireTaxId(shipping.country);
  }, [shipping.country]);
  
  // Format shipping info at component level for reuse
  const formattedShippingInfo = useMemo(() => ({
    shipping_address: {
      address: shipping.address,
      city: shipping.city,
      country: shipping.country,
      state: shipping.state || undefined,
      zip: shipping.zip,
      taxId: shipping.taxId || undefined
    },
    contact_info: {
      method: shipping.contactMethod,
      value: shipping.contactValue,
      firstName: shipping.firstName,
      lastName: shipping.lastName,
      phoneNumber: shipping.phoneNumber
    }
  }), [shipping]);
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    discountPercentage: number;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  
  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'solana' | 'free' | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Define order progress steps
  const [orderProgress, setOrderProgress] = useState<{
    step: 'initial' | 'creating_order' | 'processing_payment' | 'confirming_transaction' | 'success' | 'error';
    error?: string;
  }>({
    step: 'initial'
  });
  
  // Add state for Stripe payment modal
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [showCryptoModal, setShowCryptoModal] = useState(false);

  const [orderData, setOrderData] = useState<{
    orderIds?: Array<string>;
    orderNumbers?: Array<string>;
    transactionSignature?: string;
    batchOrderId?: string;
    createdOrderIds?: Array<string>;
    price?: number;
    fee?: number;
    couponDiscount?: number;
    walletAmounts?: Array<{ [address: string]: number }>;
  }>({});
  
  // Add the showSuccessView state within the component
  const [showSuccessView, setShowSuccessView] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | undefined>();
  
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
          contactMethod: parsedShipping.contactMethod || 'email',
          contactValue: parsedShipping.contactValue || '',
          phoneNumber: parsedShipping.phoneNumber || '',
          taxId: parsedShipping.taxId || ''
        });
      } catch (error) {
        console.error('Failed to parse saved shipping info:', error);
      }
    }
  }, []);
  
  // Save shipping info to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('lastShippingInfo', JSON.stringify({
      firstName: shipping.firstName,
      lastName: shipping.lastName,
      address: shipping.address,
      city: shipping.city,
      state: shipping.state,
      zip: shipping.zip,
      country: shipping.country,
      contactMethod: shipping.contactMethod,
      contactValue: shipping.contactValue,
      phoneNumber: shipping.phoneNumber,
      taxId: shipping.taxId
    }));
  }, [shipping]);

  // validating
  const validateItemsInCarts = async () => {
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
        setOrderProgress({ step: 'error', error: 'Some items in your cart could not be verified' });
        return false;
      }

      return false;
    }
    return true;
  }

  // Enhanced zip code change handler with country/state detection
  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZip = e.target.value;
    setShipping(prev => ({
      ...prev,
      zip: newZip
    }));
    
    // Clear any previous errors
    setZipError('');

    if (!newZip || newZip.length < 4) {
      return; // Skip validation for very short ZIPs
    }
    
    // If the country is already set, use that for validation
    if (shipping.country) {
      const countryObj = countries.find(c => c.name === shipping.country);
      const countryCode = countryObj?.code;
      
      // Validate ZIP code
      const validation = validateZipCode(newZip, countryCode);
      if (validation.error) {
        setZipError(validation.error);
      }
      
      // Try to auto-detect state for US zip codes
      if (countryCode === 'US' && !validation.error) {
        const stateCode = getStateFromZipCode(newZip);
        if (stateCode) {
          // Get the state/province from the states list
          const country = countries.find(c => c.code === 'US');
          if (country && country.states && country.states[stateCode]) {
            const stateName = country.states[stateCode][0];
            if (stateName && (!shipping.state || shipping.state !== stateName)) {
              setShipping(prev => ({
                ...prev,
                state: stateName
              }));
              
              toast.info(`State automatically set to ${stateName}`, {
                position: 'bottom-center',
                autoClose: 2000
              });
            }
          }
        }
      }
    } 
    // If country is not set, try to detect it from ZIP format
    else if (!shipping.country && newZip.length >= 5) {
      const locationInfo = getLocationFromZip(newZip);
      
      if (locationInfo) {
        setShipping(prev => ({
          ...prev,
          country: locationInfo.country,
          state: locationInfo.state || ''
        }));
        
        toast.info(`Country detected: ${locationInfo.country}${locationInfo.state ? `. State: ${locationInfo.state}` : ''}`, {
          position: 'bottom-center',
          autoClose: 3000
        });
      }
    }
  };

  // Handle phone number validation on change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setShipping(prev => ({
      ...prev,
      phoneNumber: value
    }));
    
    const validation = validatePhoneNumber(value);
    setPhoneError(validation.error || null);
  };

  // Update the generic shipping change handler to work with the enhanced input fields
  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setShipping(prev => ({ ...prev, [name]: value }));
  };
  
  // Display item prices in the order summary section
  const renderItemPrice = (item: CartItem) => {
    const price = item.priceInfo?.modifiedPrice || item.product.price;
    return (
      <div className="text-sm text-gray-200 mt-1">
        {formatPrice(price)} × {item.quantity}
      </div>
    );
  };

  // Calculate subtotal before any discounts
  const calculateSubtotal = () => {
    return items.reduce((total, item) => {
      const price = item.priceInfo?.modifiedPrice || item.product.price;
      return total + (price * item.quantity);
    }, 0);
  };
  
  // Calculate total price of all items in cart
  const totalPrice = calculateSubtotal();
  
  // Calculate final price with coupon discount
  const finalPrice = appliedCoupon 
    ? appliedCoupon.discountPercentage 
      ? totalPrice * (1 - appliedCoupon.discountPercentage / 100) 
      : totalPrice - appliedCoupon.discountAmount
    : totalPrice;
  
  // Handle coupon application
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }
    
    setValidatingCoupon(true);
    
    try {
      // Get the collection ID from the first item in the cart for validation
      // Get unique collection IDs from all items in the cart
      const collectionIds = Array.from(new Set(items.map(item => item.product.collectionId).filter(Boolean)));
      
      // Use the CouponService to validate and calculate the discount
      const result = await CouponService.calculateDiscount(
        totalPrice,
        couponCode,
        walletAddress || '',
        collectionIds
      );
      
      if (result.error || result.couponDiscount <= 0) {
        toast.error(result.error || "Invalid coupon code");
        setAppliedCoupon(null);
      } else {
        // Set applied coupon with correct format
        setAppliedCoupon({
          code: couponCode.toUpperCase(),
          discountAmount: result.couponDiscount,
          discountPercentage: result.discountDisplay?.includes('%') 
            ? parseFloat(result.discountDisplay) 
            : 0
        });
        
        toast.success(`Coupon applied: ${result.discountDisplay || result.couponDiscount + ' SOL off'}`);
      }
    } catch (error) {
      console.error("Coupon validation error:", error);
      toast.error("Error validating coupon");
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

  const handleCryptoSuccess = async (txSignature: string, batchOrderId?: string) => {
    console.log('Crypto payment successful:', txSignature, batchOrderId);
    try {
      const success = await verifyFinalTransaction(
          txSignature,
          async (status) => {
            console.log('Status update received:', status);
            
            // Handle transaction status updates
            if (status.error) {
              console.log('Setting error state:', status.error);
              setOrderProgress({ step: 'error', error: status.error });
            } else if (status.paymentConfirmed) {
              console.log('Payment confirmed, setting success state');
              
              // IMMEDIATELY set success state and update order data
              setOrderProgress({ step: 'success' });
              setOrderData(prev => ({
                ...prev,
                transactionSignature: txSignature
              }));
              
              // IMMEDIATELY clear cart - don't wait for batch refresh
              console.log('Clearing cart immediately');
              clearCart();
              
              // Handle batch order refresh in background (don't block success state)
              if (batchOrderId) {
                console.log('Starting batch order refresh in background:', batchOrderId);
                
                // Use a non-blocking approach for batch refresh
                setTimeout(async () => {
                  try {
                    const refreshResponse = await fetch('/.netlify/functions/get-batch-orders', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        batchOrderId: batchOrderId
                      })
                    });
                    
                    if (refreshResponse.ok) {
                      const refreshData = await refreshResponse.json();
                      console.log('Batch orders refresh result:', refreshData);
                      
                      if (refreshData.success && refreshData.orders) {
                        const confirmedOrders = refreshData.orders.filter((o: { status: string }) => o.status === 'confirmed').length;
                        console.log(`Batch refresh: ${confirmedOrders}/${refreshData.orders.length} orders confirmed`);
                        
                        // This is just for logging - success state is already set
                        if (confirmedOrders === refreshData.orders.length) {
                          console.log('All batch orders confirmed');
                        } else {
                          console.log('Some batch orders still pending, but transaction is confirmed');
                        }
                      }
                    }
                  } catch (refreshError) {
                    console.error('Background batch refresh error:', refreshError);
                    // Don't affect the success state - transaction is already confirmed
                  }
                }, 100); // Small delay to not block the main success flow
              }
              
              // Auto-close modal after showing success
              console.log('Setting auto-close timeout');
              setTimeout(() => {
                console.log('Auto-closing modal');
                onClose && onClose();
              }, 3000);
            }
          },
          "orderId",
          batchOrderId,
          {
            amount: finalPrice,
            buyer: walletAddress || '',
            recipient: ""
          },
        );
        
        // SAFETY: Add a timeout to ensure modal closes properly
        if (success || txSignature) {
          console.log('Setting safety timeout for success state - will trigger in 3s if not already shown');
          setTimeout(() => {
            // Check if still in confirming_transaction state
            if (orderProgress.step === 'confirming_transaction') {
              console.log('SAFETY TIMEOUT: Forcing success state as transaction was initiated');
              setOrderProgress({ step: 'success' });
              
              // Clear cart but let user decide when to close modal
              clearCart();
            }
          }, 3000);
        }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("An error occurred during checkout");
      setOrderProgress({ step: 'error', error: error instanceof Error ? error.message : 'An unknown error occurred' });
    } finally {
      setProcessingPayment(false);
    }
  }
  
  // Update the handleStripeSuccess function to receive and use batchOrderId
  const handleStripeSuccess = async (paymentIntentId: string, stripeOrderId?: string, batchOrderId?: string) => {
    console.log('Stripe payment successful:', paymentIntentId, stripeOrderId, batchOrderId);
    try {
      if (!stripeOrderId && createdOrderId) {
        stripeOrderId = createdOrderId;
      }

      if (stripeOrderId) {
        console.log('Getting order details for confirmation page:', stripeOrderId);
        try {
          const orderDetails = await getOrderDetails(stripeOrderId);
          
          if (orderDetails && orderDetails.success && orderDetails.order) {
            // Set the order data for display
            // @note:= come back here
            // setOrderData({
            //   orderIds: [stripeOrderId],
            //   orderNumber: orderDetails.order.order_number || '',
            //   transactionSignature: paymentIntentId,
            //   batchOrderId: batchOrderId || ''
            // });
            
            // Show success state and clear cart
            setOrderProgress({ step: 'success' });
            clearCart();
            
            // Show the success view
            setShowSuccessView(true);
            
            // Add success toast notification
            toast.success(
              `Order #${orderDetails.order.order_number || ''} payment confirmed!`,
              { autoClose: 5000 }
            );
          }
        } catch (error) {
          console.error('Error getting order details:', error);
          
          // Still mark as successful even without order details
          setOrderProgress({ step: 'success' });
          // setOrderData({
          //   orderId: stripeOrderId,
          //   orderNumber: '',
          //   transactionSignature: paymentIntentId,
          //   batchOrderId: batchOrderId || ''
          // });
          
          clearCart();
          setShowSuccessView(true);
        }
      } else if (batchOrderId) {
        // If we have a batch order ID but no specific order ID
        console.log('Getting batch order details for confirmation page:', batchOrderId);
        
        try {
          // Get all orders in the batch
          const response = await fetch(`/.netlify/functions/get-batch-orders?batchOrderId=${batchOrderId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (response.ok) {
            const batchData = await response.json();
            
            if (batchData.success && batchData.orders && batchData.orders.length > 0) {
              const firstOrder = batchData.orders[0];
              
              // Set the order data for display
              setOrderData({
                orderIds: firstOrder.id,
                orderNumbers: firstOrder.order_number,
                transactionSignature: paymentIntentId,
                batchOrderId: batchOrderId
              });
              
              // Show success state and clear cart
              setOrderProgress({ step: 'success' });
              clearCart();
              
              // Show the success view
              setShowSuccessView(true);
              
              // Add success toast notification
              const batchSize = items.reduce((total, item) => total + (Math.max(1, Number(item.quantity) || 1)), 0);
              toast.success(
                batchSize > 1
                  ? `Batch order #${firstOrder.order_number} with ${batchSize} items confirmed!`
                  : `Order #${firstOrder.order_number} confirmed successfully!`,
                { autoClose: 5000 }
              );
              return;
            }
          }
          
          // If we couldn't get batch details, still show generic success
          setOrderProgress({ step: 'success' });
          setOrderData({
            transactionSignature: paymentIntentId,
            batchOrderId: batchOrderId
          });
          
          clearCart();
          setShowSuccessView(true);
        } catch (error) {
          console.error('Error getting batch order details:', error);
          
          // Still mark as successful
          setOrderProgress({ step: 'success' });
          setOrderData({
            transactionSignature: paymentIntentId,
            batchOrderId: batchOrderId
          });
          
          clearCart();
          setShowSuccessView(true);
        }
      } else {
        // No order ID or batch ID, still mark as successful with minimal info
        console.log('No order ID available, showing generic success');
        setOrderProgress({ step: 'success' });
        setOrderData({
          transactionSignature: paymentIntentId
        });
        
        clearCart();
        setShowSuccessView(true);
      }
    } catch (error) {
      console.error('Error in Stripe success handler:', error);
      setOrderProgress({ step: 'error', error: 'Failed to process payment confirmation' });
    }
  };

  const createBatchTransactions = async () => {
    try {
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
          shippingInfo: formattedShippingInfo,
          walletAddress: walletAddress || 'anonymous',
          paymentMetadata: {
            paymentMethod: paymentMethod ?? 'stripe',
            couponCode: appliedCoupon?.code,
            couponDiscount: finalPrice,
            originalPrice: totalPrice
          }
        })
      });

      if(!batchOrderResponse.ok) {
        const errorData = await batchOrderResponse.json();
        throw new Error(errorData.error || 'Failed to create batch order');
      }

      const batchOrderData = await batchOrderResponse.json();

      setOrderData({
        orderIds: batchOrderData.orderIds || [],
        orderNumbers: batchOrderData.orderNumbers || [],
        batchOrderId: batchOrderData.batchOrderId,
        price: batchOrderData.finalAmount,
        fee: batchOrderData.fee,
        couponDiscount: batchOrderData.couponDiscount,
        transactionSignature: batchOrderData.transactionSignature,
        walletAmounts: batchOrderData.walletAmounts || [],
      });
      
      if(batchOrderData.batchOrderId) {
        window.sessionStorage.setItem('lastBatchOrderId', batchOrderData.batchOrderId);
      }

      // depending on payment method, we can open modal
      if (batchOrderData.isFreeOrder) {
        setPaymentMethod('free');
      }
      if( paymentMethod === 'stripe') {
        setShowStripeModal(true);
      } else if (paymentMethod === 'solana') {
        setShowCryptoModal(true);
      } 
    } catch (error) {
      throw new Error(`Failed to create batch transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const requiredFields = ['firstName', 'lastName', 'address', 'city', 'zip', 'country', 'contactValue'];
    for (const field of requiredFields) {
      if (!shipping[field as keyof typeof shipping]) {
        toast.error(`Please fill in your ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return;
      }
    }
    
    // Validate phone number before submission
    if (shipping.phoneNumber) {
      const phoneValidation = validatePhoneNumber(shipping.phoneNumber);
      if (phoneValidation.error) {
        setPhoneError(phoneValidation.error);
        toast.error("Please enter a valid phone number");
        return;
      }
    }
    
    // Validate ZIP code before submission
    const countryObj = countries.find(c => c.name === shipping.country);
    const countryCode = countryObj?.code;
    const zipValidation = validateZipCode(shipping.zip, countryCode);
    if (zipValidation.error) {
      setZipError(zipValidation.error);
      toast.error("Please enter a valid ZIP/postal code");
      return;
    }
    
    // Validate state/province is selected if available for country
    if (availableStates.length > 0 && !shipping.state) {
      toast.error('Please select a state/province');
      return;
    }
    
    // Validate tax ID if required for the country
    if (requiresTaxId && !shipping.taxId) {
      toast.error(`Tax ID is required for ${shipping.country}`);
      return;
    }
    
    // Verify wallet connection for Solana payments
    if (paymentMethod === 'solana' && !isConnected) {
      toast.info("Please connect your wallet to proceed with payment", {
        position: "bottom-center",
        autoClose: 3000
      });
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
      const isValid = await validateItemsInCarts();
      if (!isValid) {
        setProcessingPayment(false);
        return;
      }

      setOrderProgress({ step: 'creating_order' });

      await createBatchTransactions();

    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("An error occurred during checkout");
      setOrderProgress({ step: 'error', error: error instanceof Error ? error.message : 'An unknown error occurred' });
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
        {/* Show OrderSuccessView when transaction is complete */}
        {showSuccessView ? (
          <OrderSuccessView
            productName={items.length > 1 ? `${items.length} Items from Cart` : items[0]?.product.name}
            collectionName={items[0]?.product.collectionName || 'Various Collections'}
            productImage={items[0]?.product.imageUrl || '/placeholder.jpg'}
            orderNumber={orderData?.orderNumbers?.[0] || ''}
            transactionSignature={orderData.transactionSignature || ''}
            onClose={onClose}
            receiptUrl={orderData.transactionSignature}
            totalItems={items.reduce((total, item) => total + (Math.max(1, Number(item.quantity) || 1)), 0)}
            itemPosition={1}
            isBatchOrder={true}
          />
        ) : showStripeModal ? (
          <StripePaymentModal
            onClose={() => setShowStripeModal(false)}
            onSuccess={handleStripeSuccess}
            solAmount={(orderData.price || 0) + (orderData.fee || 0)}
            productName={items.length > 1 ? `Cart Items (${items.length})` : items[0]?.product.name || 'Cart Items'}
            batchOrderId={orderData.batchOrderId || ''}
            shippingInfo={formattedShippingInfo}
            variants={[]}
            couponCode={appliedCoupon?.code}
            couponDiscount={orderData.couponDiscount}
            originalPrice={orderData.price || 0}
          />
        ) : showCryptoModal ? (
          <CryptoPaymentModal
            onClose={() => setShowCryptoModal(false)}
            onSuccess={handleCryptoSuccess}
            solAmount={(orderData.price || 0) + (orderData.fee || 0)}
            productName={items.length > 1 ? `Cart Items (${items.length})` : items[0]?.product.name || 'Cart Items'}
            batchOrderId={orderData.batchOrderId || ''}
            shippingInfo={formattedShippingInfo}
            variants={[]}
            couponCode={appliedCoupon?.code}
            couponDiscount={orderData.couponDiscount}
            originalPrice={orderData.price || 0}
          />
        ) : (
          <div className="relative bg-gray-900 w-full max-w-2xl rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Checkout</h2>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="p-2 rounded-full text-gray-400 hover:text-white"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </Button>
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
                            {/* Debug output */}
                            {(() => {
                              console.log(`[Checkout] Rendering variants for ${item.product.name}:`, item.selectedOptions);
                              console.log(`[Checkout] Product variants:`, item.product.variants);
                              return null;
                            })()}
                            
                            {Object.entries(item.selectedOptions).map(([variantId, optionValue]) => {
                              console.log(`[Checkout] Processing variant ${variantId} with value ${optionValue}`);
                              
                              const variant = item.product.variants?.find(v => v.id === variantId);
                              console.log(`[Checkout] Found variant:`, variant);
                              
                              if (!variant) {
                                console.warn(`[Checkout] Variant with ID ${variantId} not found in product`, item.product);
                                return (
                                  <div key={variantId}>
                                    Option: {optionValue}
                                  </div>
                                );
                              }
                              
                              const option = variant.options?.find(o => o.value === optionValue);
                              console.log(`[Checkout] Found option:`, option);
                              
                              if (!option) {
                                console.warn(`[Checkout] Option with value ${optionValue} not found in variant ${variant.name}`, variant);
                                return (
                                  <div key={variantId}>
                                    {variant.name}: {optionValue}
                                  </div>
                                );
                              }
                              
                              return (
                                <div key={variantId}>
                                  {variant.name}: {option.label || optionValue}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {renderItemPrice(item)}
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
                      <Button 
                        onClick={handleRemoveCoupon}
                        variant="ghost"
                        size="sm"
                        className="text-xs text-gray-400 hover:text-red-400"
                      >
                        Remove
                      </Button>
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
                      <Button
                        onClick={handleApplyCoupon}
                        variant="outline"
                        size="sm"
                        isLoading={validatingCoupon}
                        disabled={validatingCoupon || !couponCode.trim()}
                      >
                        Apply
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Price Summary */}
                <div className="mt-4 border-t border-gray-800 pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Subtotal</span>
                      <span className="text-gray-300">{formatPrice(calculateSubtotal())}</span>
                    </div>
                    
                    {appliedCoupon && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Discount</span>
                        <span className="text-secondary">
                          -{formatPrice(
                            appliedCoupon.discountPercentage 
                              ? calculateSubtotal() * (appliedCoupon.discountPercentage / 100) 
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
              
              {/* Add loading/progress overlay when processing payment */}
              {orderProgress.step !== 'initial' && (
                <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="max-w-md w-full p-6 bg-gray-800 rounded-lg">
                    <div className="space-y-6">
                      <div className="text-center">
                        <h3 className="text-lg font-medium text-white mb-2">Processing Your Order</h3>
                        <p className="text-gray-400 text-sm">Please keep this window open until your order is complete.</p>
                      </div>
                      
                      {/* Order progress steps */}
                      <div className="space-y-4 mt-6">
                        <div className="flex items-center gap-3">
                          {orderProgress.step === 'creating_order' ? (
                            <Loading type={LoadingType.ACTION} />
                          ) : orderProgress.step === 'error' ? (
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          ) : ['success', 'processing_payment', 'confirming_transaction'].includes(orderProgress.step) ? (
                            <Check className="h-5 w-5 text-green-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border border-gray-600" />
                          )}
                          <span className={`text-sm ${orderProgress.step === 'creating_order' ? 'text-white' : 'text-gray-400'}`}>
                            Creating Order
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {orderProgress.step === 'processing_payment' ? (
                            <Loading type={LoadingType.ACTION} />
                          ) : orderProgress.step === 'error' ? (
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          ) : ['success', 'confirming_transaction'].includes(orderProgress.step) ? (
                            <Check className="h-5 w-5 text-green-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border border-gray-600" />
                          )}
                          <span className={`text-sm ${orderProgress.step === 'processing_payment' ? 'text-white' : 'text-gray-400'}`}>
                            Processing Payment
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {orderProgress.step === 'confirming_transaction' ? (
                            <Loading type={LoadingType.ACTION} />
                          ) : orderProgress.step === 'error' ? (
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          ) : orderProgress.step === 'success' ? (
                            <Check className="h-5 w-5 text-green-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border border-gray-600" />
                          )}
                          <span className={`text-sm ${orderProgress.step === 'confirming_transaction' ? 'text-white' : 'text-gray-400'}`}>
                            Confirming Transaction
                          </span>
                        </div>
                      </div>
                      
                      {/* Show error message if there is one */}
                      {orderProgress.error && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <p className="text-red-500 text-sm">{orderProgress.error}</p>
                        </div>
                      )}
                      
                      {/* Show order info if available */}
                      {orderData.orderNumber && (
                        <div className="mt-4 p-3 bg-gray-700/20 border border-gray-700 rounded-lg">
                          <p className="text-gray-300 text-sm">Order #{orderData.orderNumber}</p>
                          {orderData.transactionSignature && (
                            <p className="text-xs text-gray-400 mt-1 truncate">
                              Transaction: {orderData.transactionSignature}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Add cancel button */}
                      <div className="pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onClose}
                          className="w-full"
                        >
                          Close
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleCheckout} className="space-y-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Shipping Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={shipping.address}
                      onChange={handleShippingChange}
                      required
                      disabled={processingPayment}
                      className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-secondary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Enter your street address"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        City
                      </label>
                      <input
                        type="text"
                        id="city"
                        name="city"
                        value={shipping.city}
                        onChange={handleShippingChange}
                        required
                        disabled={processingPayment}
                        className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-secondary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="City"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        ZIP / Postal Code
                      </label>
                      <input
                        type="text"
                        id="zip"
                        name="zip"
                        value={shipping.zip}
                        onChange={handleZipChange}
                        required
                        disabled={processingPayment}
                        className={`w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-secondary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                          zipError ? 'border border-red-500' : ''
                        }`}
                        placeholder="ZIP code"
                      />
                      {zipError && (
                        <p className="mt-1 text-sm text-red-500">{zipError}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Country
                      </label>
                      <ComboBox
                        value={shipping.country}
                        onChange={(value) => setShipping(prev => ({
                          ...prev,
                          country: value,
                          state: '' // Reset state when country changes
                        }))}
                        options={countries.map(country => ({
                          value: country.name,
                          label: country.name,
                          secondaryLabel: country.code
                        }))}
                        required
                        disabled={processingPayment}
                        placeholder="Type country name or code (e.g. US, Canada)"
                        name="country"
                        id="country"
                      />
                    </div>

                    {availableStates.length > 0 ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          State / Province
                        </label>
                        <ComboBox
                          value={shipping.state || ''}
                          onChange={(value) => setShipping(prev => ({
                            ...prev,
                            state: value
                          }))}
                          options={availableStates.map(state => ({
                            value: state.name,
                            label: state.name,
                            secondaryLabel: state.code
                          }))}
                          required
                          disabled={processingPayment}
                          placeholder="Type or select state/province"
                          name="state"
                          id="state"
                        />
                      </div>
                    ) : (
                      <div className="hidden sm:block"> {/* Empty div for grid alignment when no state field */}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={shipping.firstName}
                        onChange={handleShippingChange}
                        required
                        disabled={processingPayment}
                        className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-secondary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={shipping.lastName}
                        onChange={handleShippingChange}
                        required
                        disabled={processingPayment}
                        className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-secondary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Last name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={shipping.phoneNumber}
                      onChange={handlePhoneChange}
                      required
                      disabled={processingPayment}
                      className={`w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-secondary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                        phoneError ? 'border border-red-500' : ''
                      }`}
                      placeholder="+1234567890"
                    />
                    {phoneError && (
                      <p className="mt-1 text-sm text-red-500">{phoneError}</p>
                    )}
                  </div>

                  {/* Conditional Tax ID field for countries that require it */}
                  {requiresTaxId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Tax ID <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        id="taxId"
                        name="taxId"
                        value={shipping.taxId || ''}
                        onChange={handleShippingChange}
                        required={requiresTaxId}
                        disabled={processingPayment}
                        className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-secondary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder={`Enter your ${shipping.country === 'United States' ? 'EIN or SSN' : 'tax ID'}`}
                      />
                      <p className="mt-1 text-xs text-amber-400">
                        A tax ID is required for shipping to {shipping.country}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Contact Method
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <select
                        value={shipping.contactMethod}
                        onChange={(e) => setShipping(prev => ({
                          ...prev,
                          contactMethod: e.target.value,
                          contactValue: '' // Reset value when changing method
                        }))}
                        className="w-full sm:w-auto bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-secondary"
                        disabled={processingPayment}
                      >
                        <option value="telegram">Telegram</option>
                        <option value="email">Email</option>
                        <option value="x">X (Twitter)</option>
                      </select>
                      <div className="flex-1 min-w-0">
                        <input
                          type={shipping.contactMethod === 'email' ? 'email' : 'text'}
                          value={shipping.contactValue}
                          onChange={(e) => setShipping(prev => ({
                            ...prev,
                            contactValue: e.target.value
                          }))}
                          required
                          disabled={processingPayment}
                          className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-secondary placeholder-gray-500 truncate disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder={
                            shipping.contactMethod === 'telegram' ? '@username' :
                            shipping.contactMethod === 'email' ? 'email@example.com' :
                            '@handle'
                          }
                        />
                      </div>
                    </div>
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
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={processingPayment}
                    loadingText={processingPayment ? "Processing..." : ""}
                    disabled={processingPayment || (paymentMethod === 'solana' && !isConnected) || !paymentMethod || 
                      !shipping.address || !shipping.city || 
                      !shipping.country || !shipping.zip || 
                      (availableStates.length > 0 && !shipping.state) ||
                      !shipping.contactValue || !shipping.firstName ||
                      !shipping.lastName || !shipping.phoneNumber || 
                      (shipping.country && doesCountryRequireTaxId(shipping.country) && !shipping.taxId) ||
                      !!phoneError || !!zipError}
                    className="w-full"
                  >
                    {!isConnected && paymentMethod === 'solana' ? (
                      <>
                        <Wallet className="h-4 w-4 mr-2" />
                        <span>Connect Wallet</span>
                      </>
                    ) : (
                      <>
                        <span>Continue to Payment</span>
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 