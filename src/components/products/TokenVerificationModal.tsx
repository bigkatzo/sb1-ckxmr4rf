import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { verifyTokenHolding } from '../../utils/token-verification';
import { verifyWhitelistAccess } from '../../utils/whitelist-verification';
import { usePayment } from '../../hooks/usePayment';
import { toast } from 'react-toastify';
import { toastService } from '../../services/toast';
import type { Product } from '../../types/variants';
import type { CategoryRule } from '../../types';
import { useModifiedPrice } from '../../hooks/useModifiedPrice';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { supabase } from '../../lib/supabase';
import { verifyNFTHolding } from '../../utils/nft-verification';
import { monitorTransaction } from '../../utils/transaction-monitor';
import { OrderSuccessView } from '../OrderSuccessView';
import { validatePhoneNumber, validateZipCode, getStateFromZipCode } from '../../lib/validation';
import { StripePaymentModal } from './StripePaymentModal';
import { CouponService } from '../../services/coupons';
import type { PriceWithDiscount } from '../../types/coupons';
import { API_BASE_URL, API_ENDPOINTS } from '../../config/api';
import { countries, getStatesByCountryCode } from '../../data/countries';
import { ComboBox } from '../ui/ComboBox';
import { getLocationFromZip, doesCountryRequireTaxId } from '../../utils/addressUtil';

interface TokenVerificationModalProps {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
  selectedOption?: Record<string, string>;
  shippingInfo?: any;
  paymentMetadata?: any;
}

interface ShippingInfo {
  address: string;
  city: string;
  country: string;
  state?: string;
  zip: string;
  contactMethod: string;
  contactValue: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  taxId?: string;
}

const STORAGE_KEY = 'lastShippingInfo';

interface VerificationResult {
  isValid: boolean;
  error?: string;
  balance?: number;
}

// Add new interface for progress steps
interface ProgressStep {
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  description?: string;
  details?: {
    success?: string;
    error?: string;
  };
}

async function verifyRule(rule: CategoryRule, walletAddress: string): Promise<{ isValid: boolean; error?: string }> {
  switch (rule.type) {
    case 'token':
      return verifyTokenHolding(walletAddress, rule.value, rule.quantity || 1);
    case 'nft':
      return verifyNFTHolding(walletAddress, rule.value, rule.quantity || 1);
    case 'whitelist':
      return verifyWhitelistAccess(walletAddress, rule.value);
    default:
      return { isValid: false, error: `Unknown rule type: ${rule.type}` };
  }
}

export function TokenVerificationModal({ 
  product, 
  onClose, 
  onSuccess,
  selectedOption = {},
  shippingInfo = {},
  paymentMetadata = {}
}: TokenVerificationModalProps) {
  const { walletAddress, isConnected } = useWallet();
  const { processPayment } = usePayment();
  const [verifying, setVerifying] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { modifiedPrice: baseModifiedPrice } = useModifiedPrice({
    product,
    selectedOptions: selectedOption
  });
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [showSuccessView, setShowSuccessView] = useState(false);
  const [orderDetails, setOrderDetails] = useState<{
    orderNumber: string;
    transactionSignature: string;
  } | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<PriceWithDiscount | null>(null);
  
  // Update progress steps to reflect new flow
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([
    { 
      label: 'Order Creation',
      status: 'pending',
      details: {
        success: 'Order created successfully',
        error: 'Failed to create order'
      }
    },
    { 
      label: 'Payment Processing',
      status: 'pending',
      details: {
        success: 'Payment confirmed on Solana network',
        error: 'Unable to process payment'
      }
    },
    { 
      label: 'Transaction Confirmation',
      status: 'pending',
      details: {
        success: 'Transaction finalized on-chain',
        error: 'Transaction verification failed'
      }
    }
  ]);

  // Add helper function to update progress steps
  const updateProgressStep = (index: number, status: ProgressStep['status'], description?: string, errorDetails?: string) => {
    setProgressSteps(steps => steps.map((step, i) => 
      i === index ? { 
        ...step, 
        status, 
        description,
        details: {
          ...step.details,
          error: status === 'error' ? errorDetails || step.details?.error : step.details?.error,
          success: status === 'completed' ? step.details?.success : step.details?.success
        }
      } : step
    ));
  };

  // Calculate final price including variants, modifications, and coupon
  const finalPrice = couponResult?.finalPrice ?? baseModifiedPrice;

  // Initialize shipping info from props first (if provided by cart checkout) or localStorage
  const [shippingInfoState, setShippingInfoState] = useState<ShippingInfo>(() => {
    // If we have shipping info from props, use that
    if (shippingInfo && Object.keys(shippingInfo).length > 0) {
      // Format from cart checkout format to TokenVerificationModal format
      const propsShippingInfo = {
        address: shippingInfo.address || '',
        city: shippingInfo.city || '',
        country: shippingInfo.country || '',
        state: shippingInfo.state || '',
        zip: shippingInfo.zip || '',
        contactMethod: 'telegram', // Default contact method
        contactValue: shippingInfo.email || '',
        firstName: shippingInfo.firstName || '',
        lastName: shippingInfo.lastName || '',
        phoneNumber: shippingInfo.phone || '',
        taxId: ''
      };
      return propsShippingInfo;
    }
    
    // Otherwise, use localStorage
    const savedInfo = localStorage.getItem(STORAGE_KEY);
    return savedInfo ? JSON.parse(savedInfo) : {
      address: '',
      city: '',
      country: '',
      state: '',
      zip: '',
      contactMethod: 'telegram',
      contactValue: '',
      firstName: '',
      lastName: '',
      phoneNumber: '',
      taxId: ''
    };
  });

  // Add state for ZIP validation
  const [zipError, setZipError] = useState<string>('');
  
  // Get states for the selected country
  const availableStates = useMemo(() => {
    const countryCode = countries.find(c => c.name === shippingInfoState.country)?.code;
    return countryCode ? getStatesByCountryCode(countryCode) : [];
  }, [shippingInfoState.country]);

  // Enhance the handleZipChange function to detect country when possible
  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZip = e.target.value;
    setShippingInfoState(prev => ({
      ...prev,
      zip: newZip
    }));
    
    // Clear any previous errors
    setZipError('');

    if (!newZip || newZip.length < 4) {
      return; // Skip validation for very short ZIPs
    }
    
    // If the country is already set, use that for validation
    if (shippingInfoState.country) {
      const countryObj = countries.find(c => c.name === shippingInfoState.country);
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
            if (stateName && (!shippingInfoState.state || shippingInfoState.state !== stateName)) {
              setShippingInfoState(prev => ({
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
    else if (!shippingInfoState.country && newZip.length >= 5) {
      const locationInfo = getLocationFromZip(newZip);
      
      if (locationInfo) {
        setShippingInfoState(prev => ({
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

  // Save shipping info to localStorage whenever it changes
  useEffect(() => {
    console.log('Shipping info updated:', shippingInfoState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shippingInfoState));
  }, [shippingInfoState]);

  // Validate phone number on initial load
  useEffect(() => {
    if (shippingInfoState.phoneNumber) {
      const validation = validatePhoneNumber(shippingInfoState.phoneNumber);
      setPhoneError(validation.error || '');
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    async function verifyAccess() {
      if (!walletAddress) {
        console.log('Wallet not connected, setting verification to false');
        setVerificationResult({ isValid: false, error: 'Wallet not connected' });
        setVerifying(false);
        return;
      }

      // If no category or no rule groups, user is eligible
      if (!product.category?.eligibilityRules?.groups?.length) {
        console.log('No eligibility rules found, setting verification to true');
        setVerificationResult({ isValid: true });
        setVerifying(false);
        return;
      }

      try {
        // Verify each group of rules
        const groupResults = await Promise.all(
          product.category.eligibilityRules.groups.map(async group => {
            // Verify all rules in the group
            const ruleResults = await Promise.all(
              group.rules.map(rule => verifyRule(rule, walletAddress))
            );

            if (group.operator === 'AND') {
              // All rules must pass for AND
              const isValid = ruleResults.every(result => result.isValid);
              const error = ruleResults.find(result => result.error)?.error;
              return { isValid, error };
            } else {
              // At least one rule must pass for OR
              const isValid = ruleResults.some(result => result.isValid);
              const error = isValid ? undefined : 'None of the requirements were met';
              return { isValid, error };
            }
          })
        );

        // All groups must pass (groups are always AND'ed together)
        const isValid = groupResults.every(result => result.isValid);
        const error = groupResults.find(result => !result.isValid)?.error;

        setVerificationResult({ isValid, error });
      } catch (error) {
        console.error('Verification error:', error);
        setVerificationResult({
          isValid: false,
          error: error instanceof Error ? error.message : 'Verification failed'
        });
      } finally {
        setVerifying(false);
      }
    }

    verifyAccess();
  }, [walletAddress, product]);

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!isConnected) {
        toast.error('Please connect your wallet first');
        return;
      }
      
      // Format variant selections for database
      const formattedVariantSelections = Object.entries(selectedOption).map(([variantId, value]) => {
        // Find the variant name from product.variants
        const variant = product.variants?.find(v => v.id === variantId);
        return {
          name: variant?.name || variantId, // Use variant name, fallback to variant ID
          value
        };
      });
      
      setSubmitting(true);
      setProgressSteps(prevSteps => 
        prevSteps.map((step, i) => 
          i === 0 ? { ...step, status: 'processing' } : step
        )
      );
      
      // For free orders with 100% discount, use a different flow
      if (isFreeOrder && couponResult) {
        await handleFreeOrder();
        return;
      }

      // Start order creation process
      updateProgressStep(0, 'processing', 'Creating your order...');
      
      let orderResponse;
      let orderId;
      let orderNumber;
      
      // If user has a batch checkout from cart, use batch order endpoint
      if (paymentMetadata?.isBatchOrder) {
        // For batch orders, use the batch order endpoint
        orderResponse = await fetch('/.netlify/functions/create-batch-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            items: [{
              product,
              selectedOptions: selectedOption,
              quantity: 1
            }],
            shippingInfo: {
              shipping_address: {
                address: shippingInfoState.address,
                city: shippingInfoState.city,
                country: shippingInfoState.country,
                state: shippingInfoState.state || undefined,
                zip: shippingInfoState.zip,
                taxId: shippingInfoState.taxId || undefined
              },
              contact_info: {
                method: shippingInfoState.contactMethod,
                value: shippingInfoState.contactValue,
                firstName: shippingInfoState.firstName,
                lastName: shippingInfoState.lastName,
                phoneNumber: shippingInfoState.phoneNumber
              }
            },
            walletAddress,
            paymentMetadata: {
              ...paymentMetadata,
              paymentMethod: 'solana'
            }
          })
        });
            
        const batchData = await orderResponse.json();
            
        if (!batchData.success) {
          throw new Error(batchData.error || 'Failed to create batch order');
        }
            
        orderId = batchData.orders?.[0]?.orderId; // Get the first order ID
            
        // Get order number from the response
        orderNumber = batchData.orderNumber;
      } else {
        // For regular single orders, use the regular order endpoint
        orderResponse = await fetch('/.netlify/functions/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            productId: product.id,
            variants: formattedVariantSelections,
            shippingInfo: {
              shipping_address: {
                address: shippingInfoState.address,
                city: shippingInfoState.city,
                country: shippingInfoState.country,
                state: shippingInfoState.state || undefined,
                zip: shippingInfoState.zip,
                taxId: shippingInfoState.taxId || undefined
              },
              contact_info: {
                method: shippingInfoState.contactMethod,
                value: shippingInfoState.contactValue,
                firstName: shippingInfoState.firstName,
                lastName: shippingInfoState.lastName,
                phoneNumber: shippingInfoState.phoneNumber
              }
            },
            walletAddress,
            paymentMetadata: {
              ...paymentMetadata,
              orderSource: 'token_modal',
              paymentMethod: 'solana',
              isBatchOrder: false,
              isSingleItemOrder: true
            }
          })
        });

        const orderData = await orderResponse.json();
        if (orderData.error) {
          throw new Error(orderData.error);
        }
        
        orderId = orderData.orderId;
        
        // Get order number from any of the formats
        orderNumber = orderData.orderNumber || 
                     orderData.orders?.[0]?.orderNumber || 
                     `SF-${Date.now().toString().slice(-6)}`;  // Fallback that matches pattern
      }

      updateProgressStep(0, 'completed');

      // Start payment processing
      updateProgressStep(1, 'processing', 'Initiating payment on Solana network...');
      
      // Process payment with modified price
      const { success: paymentSuccess, signature: txSignature } = await processPayment(finalPrice, product.collectionId);
      
      if (!paymentSuccess || !txSignature) {
        updateProgressStep(1, 'error', undefined, 'Payment failed');
        
        // Update order to pending_payment status even if payment fails
        try {
          const updateResponse = await fetch('/.netlify/functions/update-order-transaction', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              orderId,
              transactionSignature: 'rejected', // Use a special value for rejected transactions
              amountSol: finalPrice
            })
          });

          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            console.error('Failed to update order status:', errorData.error);
          }
        } catch (err) {
          console.error('Error updating order status:', err);
        }
        
        throw new Error('Payment failed');
      }

      // Update order with transaction signature
      try {
        const updateResponse = await fetch('/.netlify/functions/update-order-transaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            orderId,
            transactionSignature: txSignature,
            amountSol: finalPrice
          })
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          
          // Check if this is the error about order not being in draft status
          // This can happen if the server already processed the order
          if (errorData.error && errorData.error.includes('not in draft status')) {
            console.log('Order already processed by server, continuing with transaction monitoring');
            // We can continue without treating this as an error
          } else {
            throw new Error(errorData.error || 'Failed to update order transaction');
          }
        }
        
        // Payment initiated successfully
        updateProgressStep(1, 'completed');
        
        // Start transaction confirmation
        updateProgressStep(2, 'processing', 'Waiting for transaction confirmation...');
        
        // Expected transaction details for server verification
        const expectedDetails = {
          amount: finalPrice,
          buyer: walletAddress || '',
          recipient: product.collectionId // Collection address as recipient
        };
        
        // Monitor transaction status and confirm on chain
        const transactionSuccess = await monitorTransaction(
          txSignature,
          (status) => {
            console.log('Transaction status update:', status);
            if (status.error) {
              updateProgressStep(2, 'error', undefined, status.error);
            } else if (status.paymentConfirmed) {
              updateProgressStep(2, 'completed', 'Transaction confirmed!');
              
              // Add immediate success trigger when paymentConfirmed is true
              console.log('Payment confirmed, triggering success view');
              // Use the order number from the API response, fall back to a generated one if not available
              const displayOrderNumber = orderNumber || `ORD-${Date.now().toString(36)}-${orderId?.substring(0, 6) || 'unknown'}`;
              
              // Important: Force full sequence order, use functional state update
              setOrderDetails({
                orderNumber: displayOrderNumber,
                transactionSignature: txSignature || ''
              });
              
              // Force re-render by triggering in the next tick
              setTimeout(() => {
                setShowSuccessView(true);
                toastService.showOrderSuccess();
                onSuccess();
              }, 50);
            }
          },
          expectedDetails,
          orderId
        );

        // SAFETY: Add a timeout for direct success if callbacks aren't working
        // In case the monitorTransaction callback is not triggered or has issues
        if (transactionSuccess) {
          console.log('Setting safety timeout for success view - will trigger in 2s if not already shown');
          setTimeout(() => {
            // Check if the success view is showing by looking at the state
            if (!showSuccessView) {
              console.log('SAFETY TIMEOUT: Forcing success view to show as callback may have failed');
              const displayOrderNumber = orderNumber || `ORD-${Date.now().toString(36)}-${orderId?.substring(0, 6) || 'unknown'}`;
              setOrderDetails({
                orderNumber: displayOrderNumber,
                transactionSignature: txSignature || ''
              });
              
              // Force re-render by triggering in the next tick
              setTimeout(() => {
                setShowSuccessView(true);
                toastService.showOrderSuccess();
                onSuccess();
              }, 50);
            }
          }, 2000);
        }

        if (!transactionSuccess) {
          updateProgressStep(2, 'error', undefined, 'Transaction verification failed. Order will remain in pending_payment status for merchant review.');
          // Don't throw error here, let the merchant handle it
          
          // Create order details for the success view using real order number if available
          const displayOrderNumber = orderNumber || `ORD-${Date.now().toString(36)}-${orderId?.substring(0, 6) || 'unknown'}`;
          
          // Force reliable state update sequence
          setOrderDetails({
            orderNumber: displayOrderNumber,
            transactionSignature: txSignature || ''
          });
          
          // Use setTimeout to ensure state updates processed in order
          setTimeout(() => {
            setShowSuccessView(true);
            toastService.showOrderSuccess();
            onSuccess();
          }, 50);
          
          return;
        }
        
        // Server-side verification confirms the transaction and updates the order status automatically
        // We don't need to make another call to confirm_order_transaction

        updateProgressStep(2, 'completed');
      } catch (error) {
        console.error('Order error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to place order';
        toast.error(errorMessage, {
          autoClose: false
        });
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Order error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to place order';
      toast.error(errorMessage, {
        autoClose: false
      });
      setSubmitting(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setShippingInfoState(prev => ({
      ...prev,
      phoneNumber: value
    }));
    
    const validation = validatePhoneNumber(value);
    setPhoneError(validation.error || '');
  };

  // Track the created order ID for Stripe payments
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  const handleStripeSuccess = async (paymentIntentId: string) => {
    try {
      console.log('Stripe payment successful:', { orderId: createdOrderId, paymentIntentId });
      
      // Skip confirmation call for free orders - they are already confirmed during creation
      const isFreeOrder = paymentIntentId.startsWith('free_');
      
      // Only call the confirmation endpoint for regular Stripe payments, not free orders
      if (!isFreeOrder && createdOrderId) {
        try {
          const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.confirmStripeOrder}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: createdOrderId, paymentIntentId })
          });
          
          const result = await response.json();
          console.log('Client-side order confirmation result:', result);
        } catch (confirmError) {
          console.error('Error with client-side order confirmation:', confirmError);
          // Continue with the process even if this fails
        }
      }
      
      // Try to fetch the latest order data first to get the correct order number
      try {
        if (createdOrderId) {
          // Check if orderId is a UUID or an order number 
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdOrderId);
          
          let query;
          if (isUuid) {
            query = supabase
              .from('orders')
              .select('id, order_number, status')
              .eq('id', createdOrderId)
              .single();
          } else {
            // If it's an order number (e.g., ORD12345), query by order_number
            query = supabase
              .from('orders')
              .select('id, order_number, status')
              .eq('order_number', createdOrderId)
              .single();
          }
          
          const { data: order, error } = await query;
          
          if (error) {
            throw error;
          }
          
          if (order && order.order_number) {
            console.log('Found order details:', order);
            
            // Use the retrieved order number
            setOrderDetails({
              orderNumber: order.order_number,
              transactionSignature: paymentIntentId
            });
            
            // Always show success view and toast for Stripe payments
            setShowSuccessView(true);
            toastService.showOrderSuccess();
            onSuccess();
            return;
          }
        }
      } catch (fetchError) {
        console.warn('Could not fetch order details, using fallback:', fetchError);
      }
      
      // Create a proper order details object as fallback
      const fallbackOrderNumber = `ORD-${Date.now().toString(36)}-${createdOrderId?.substring(0, 6) || 'unknown'}`;
      setOrderDetails({
        orderNumber: fallbackOrderNumber,
        transactionSignature: paymentIntentId
      });
      
      // Always show success view and toast for Stripe payments
      setShowSuccessView(true);
      toastService.showOrderSuccess();
      onSuccess();
    } catch (error) {
      console.error('Error handling Stripe success:', error);
      
      // Even if there's an error getting order details, still show success
      const fallbackOrderNumber = `ORD-${Date.now().toString(36)}-${createdOrderId?.substring(0, 6) || 'unknown'}`;
      setOrderDetails({
        orderNumber: fallbackOrderNumber,
        transactionSignature: paymentIntentId
      });
      
      setShowSuccessView(true);
      toastService.showOrderSuccess();
      onSuccess();
    }
  };

  // Add progress indicator component
  const ProgressIndicator = () => (
    <div className="space-y-6 p-6 bg-gray-800/50 rounded-lg">
      <h3 className="text-sm font-medium text-gray-300">Order Progress</h3>
      <div className="relative space-y-6">
        {progressSteps.map((step, index) => (
          <div key={step.label} className="relative">
            {/* Timeline connector */}
            {index < progressSteps.length - 1 && (
              <div className={`absolute left-[15px] top-8 w-[2px] h-[calc(100%+8px)] -ml-px transition-colors duration-300 ${
                step.status === 'completed' ? 'bg-green-500/50' :
                step.status === 'processing' ? 'bg-secondary-500/50 animate-pulse' :
                'bg-gray-700'
              }`} />
            )}
            
            <div className={`relative flex items-start gap-4 transition-opacity duration-300 ${
              step.status === 'processing' ? 'opacity-100' : 'opacity-70'
            }`}>
              {/* Status indicator */}
              <div className={`relative flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                step.status === 'completed' ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/30' :
                step.status === 'processing' ? 'bg-secondary-500/20 text-secondary-400 ring-2 ring-secondary-500/30 scale-110' :
                step.status === 'error' ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/30' :
                'bg-gray-700/50 text-gray-400'
              }`}>
                {step.status === 'completed' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : step.status === 'processing' ? (
                  <div className="relative">
                    <Loading type={LoadingType.ACTION} />
                    <div className="absolute inset-0 rounded-full animate-[ping_2s_ease-in-out_infinite]">
                      <div className="absolute inset-0 rounded-full bg-secondary-500/30 animate-[ping_2s_ease-in-out_infinite_0.75s]" />
                    </div>
                  </div>
                ) : step.status === 'error' ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-current" />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-medium transition-colors duration-300 ${
                    step.status === 'completed' ? 'text-green-400' :
                    step.status === 'processing' ? 'text-secondary-400' :
                    step.status === 'error' ? 'text-red-400' :
                    'text-gray-400'
                  }`}>
                    {step.label}
                  </p>
                </div>
                
                {/* Status messages */}
                <div className="mt-1">
                  {(step.status === 'completed' && step.details?.success) && (
                    <p className="text-xs text-green-400/80 animate-fadeIn">{step.details.success}</p>
                  )}
                  {(step.status === 'error' && step.details?.error) && (
                    <p className="text-xs text-red-400/80 animate-fadeIn">{step.details.error}</p>
                  )}
                  {step.status === 'processing' && (
                    <p className="text-xs text-secondary-400/80 animate-pulse">Processing...</p>
                  )}
                  {step.description && (
                    <p className="text-xs text-gray-500">{step.description}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Add this function to handle free orders consistently in the parent component
  const handleFreeOrder = async (paymentMethod = 'free_order') => {
    try {
      console.log('Processing free order in parent component');
      setSubmitting(true);
      
      // Generate a consistent transaction ID for free orders to prevent duplicates
      const transactionId = `free_order_${product.id}_${couponResult?.couponCode || 'nocoupon'}_${walletAddress || 'anonymous'}_${Date.now()}`;
      
      let response;
      let responseData;
      
      try {
        // Call the create-order endpoint with the free order flag
        response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.createOrder}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            productId: product.id,
            variants: selectedOption || {},
            shippingInfo: {
              shipping_address: {
                address: shippingInfoState.address,
                city: shippingInfoState.city,
                country: shippingInfoState.country,
                state: shippingInfoState.state,
                zip: shippingInfoState.zip
              },
              contact_info: {
                method: shippingInfoState.contactMethod,
                value: shippingInfoState.contactValue,
                firstName: shippingInfoState.firstName,
                lastName: shippingInfoState.lastName,
                phoneNumber: shippingInfoState.phoneNumber
              }
            },
            walletAddress: walletAddress || 'anonymous',
            paymentMetadata: {
              paymentMethod,
              couponCode: couponResult?.couponCode,
              couponDiscount: couponResult?.couponDiscount,
              originalPrice: baseModifiedPrice,
              isFreeOrder: true,
              transactionId
            }
          }),
        });
          
        responseData = await response.json();
          
        if (responseData.error) {
          throw new Error(responseData.error);
        }
        
        console.log('Free order created successfully:', responseData);
          
        // Get order number from any of the formats
        const displayOrderNumber = responseData.orderNumber || 
                                   responseData.orders?.[0]?.orderNumber || 
                                   responseData.orderId || 
                                   'Unknown';
        
        // Show order success
        setOrderDetails({
          orderNumber: displayOrderNumber,
          transactionSignature: responseData.transactionSignature || responseData.paymentIntentId || transactionId
        });
          
        setShowSuccessView(true);
        toastService.showOrderSuccess();
        onSuccess();
      } catch (error) {
        console.error('Error creating free order:', error);
        toast.error('Failed to process order');
      } finally {
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Free order error:', error);
      setSubmitting(false);
    }
  };

  // Add a helper method to check if an order is free
  const isFreeOrder = useMemo(() => {
    return couponResult?.couponDiscount !== undefined && 
      baseModifiedPrice !== undefined &&
      couponResult.couponDiscount > 0 && 
      (couponResult.couponDiscount >= baseModifiedPrice || 
       (baseModifiedPrice > 0 && (couponResult.couponDiscount / baseModifiedPrice) * 100 >= 100));
  }, [couponResult, baseModifiedPrice]);

  // Add a click handler for the payment method buttons
  const handlePaymentClick = (method: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    
    // For free orders, handle them directly regardless of the payment method selected
    if (isFreeOrder) {
      handleFreeOrder(`free_order_${method}`);
      return;
    }
    
    // For non-free orders, proceed with normal payment flow
    if (method === 'stripe') {
      // First create the order and save the order ID
      handleStripeOrderCreation();
    } else if (method === 'solana') {
      handleShippingSubmit(new Event('submit') as unknown as React.FormEvent);
    }
  };

  // Add a function to handle order creation for Stripe payments
  const handleStripeOrderCreation = async () => {
    try {
      setSubmitting(true);
      updateProgressStep(0, 'processing', 'Creating order for Stripe payment...');
      
      // Format variant selections for database  
      const formattedVariantSelections = Object.entries(selectedOption).map(([variantId, value]) => {
        // Find the variant name from product.variants
        const variant = product.variants?.find(v => v.id === variantId);
        return {
          name: variant?.name || variantId, // Use variant name, fallback to variant ID
          value
        };
      });
      
      const response = await fetch('/.netlify/functions/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId: product.id,
          variants: formattedVariantSelections,
          shippingInfo: {
            shipping_address: {
              address: shippingInfoState.address,
              city: shippingInfoState.city,
              country: shippingInfoState.country,
              state: shippingInfoState.state || undefined,
              zip: shippingInfoState.zip,
              taxId: shippingInfoState.taxId || undefined
            },
            contact_info: {
              method: shippingInfoState.contactMethod,
              value: shippingInfoState.contactValue,
              firstName: shippingInfoState.firstName,
              lastName: shippingInfoState.lastName,
              phoneNumber: shippingInfoState.phoneNumber
            }
          },
          walletAddress,
          paymentMetadata: {
            orderSource: 'token_modal',
            paymentMethod: 'stripe',
            isBatchOrder: false,
            isSingleItemOrder: true,
            couponCode: couponResult?.couponCode,
            couponDiscount: couponResult?.couponDiscount
          }
        })
      });
      
      const orderData = await response.json();
      
      if (orderData.error) {
        updateProgressStep(0, 'error', undefined, orderData.error);
        toast.error(orderData.error);
        setSubmitting(false);
        return;
      }
      
      // Store the order ID for later use when Stripe payment completes
      setCreatedOrderId(orderData.orderId);
      updateProgressStep(0, 'completed');
      
      // Show the Stripe modal
      setShowStripeModal(true);
      setSubmitting(false);
    } catch (error) {
      console.error("Error creating order for Stripe:", error);
      updateProgressStep(0, 'error', undefined, error instanceof Error ? error.message : 'Failed to create order');
      toast.error("Failed to create order for payment processing");
      setSubmitting(false);
    }
  };

  // Initialize coupon data from paymentMetadata if available
  useEffect(() => {
    if (paymentMetadata && paymentMetadata.couponCode) {
      setCouponCode(paymentMetadata.couponCode);
      
      // Set coupon result for cart checkouts with valid coupon
      if (paymentMetadata.originalPrice && paymentMetadata.couponDiscount) {
        setCouponResult({
          couponCode: paymentMetadata.couponCode,
          originalPrice: paymentMetadata.originalPrice,
          couponDiscount: paymentMetadata.couponDiscount,
          finalPrice: paymentMetadata.originalPrice - paymentMetadata.couponDiscount
        });
      }
    }
  }, [paymentMetadata]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/80 backdrop-blur-lg">
      {showSuccessView && orderDetails ? (
        <OrderSuccessView
          productName={product.name}
          collectionName={product.collectionName || 'Unknown Collection'}
          productImage={product.imageUrl}
          orderNumber={orderDetails.orderNumber || `SF-${Date.now().toString().slice(-6)}`}
          transactionSignature={orderDetails.transactionSignature}
          onClose={onSuccess}
        />
      ) : showStripeModal ? (
        <StripePaymentModal
          onClose={() => setShowStripeModal(false)}
          onSuccess={handleStripeSuccess}
          solAmount={finalPrice}
          productName={product.name}
          productId={product.id}
          shippingInfo={{
            shipping_address: {
              address: shippingInfoState.address,
              city: shippingInfoState.city,
              country: shippingInfoState.country,
              zip: shippingInfoState.zip,
            },
            contact_info: {
              method: shippingInfoState.contactMethod,
              value: shippingInfoState.contactValue,
              firstName: shippingInfoState.firstName,
              lastName: shippingInfoState.lastName,
              phoneNumber: shippingInfoState.phoneNumber,
            }
          }}
          variants={Object.entries(selectedOption).map(([variantId, value]) => {
            // Find the variant name from product.variants
            const variant = product.variants?.find(v => v.id === variantId);
            return {
              name: variant?.name || variantId, // Use variant name, fallback to variant ID
              value
            };
          })}
          couponCode={couponResult?.couponCode}
          couponDiscount={couponResult?.couponDiscount}
          originalPrice={product.price}
        />
      ) : (
        <div className="relative max-w-lg w-full bg-gray-900 rounded-xl p-6">
          <div className="p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Complete Your Purchase</h2>
            <button
              onClick={onClose}
              disabled={submitting}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
            {/* Verification Status */}
            {product.category?.eligibilityRules?.groups?.length ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-800/50">
                {verifying ? (
                  <>
                    <Loading type={LoadingType.ACTION} text="Verifying eligibility..." />
                  </>
                ) : verificationResult?.isValid ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    <span className="text-gray-100">You are eligible to purchase this item!</span>
                  </>
                ) : (
                  <>
                    <div className="w-full flex flex-col items-center gap-3 py-2">
                      <AlertTriangle className="h-10 w-10 text-red-500" />
                      <div className="text-center">
                        <p className="text-red-500 font-semibold text-lg">Access Denied</p>
                        {verificationResult?.error && (
                          <p className="text-gray-400 text-sm mt-1">{verificationResult.error}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-800/50">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <span className="text-gray-100">This item is available to all collectors!</span>
              </div>
            )}

            {/* Show either the shipping form or progress indicator */}
            {(!product.category?.eligibilityRules?.groups?.length || verificationResult?.isValid) && (
              <form onSubmit={handleShippingSubmit} className="space-y-4">
                {submitting ? (
                  <>
                    <ProgressIndicator />
                    <div className="pt-4 border-t border-gray-800">
                      <button
                        type="submit"
                        disabled
                        className="w-full bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <span>Processing...</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Street Address
                        </label>
                        <input
                          type="text"
                          value={shippingInfoState.address}
                          onChange={(e) => setShippingInfoState(prev => ({
                            ...prev,
                            address: e.target.value
                          }))}
                          required
                          disabled={submitting}
                          className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                            value={shippingInfoState.city}
                            onChange={(e) => setShippingInfoState(prev => ({
                              ...prev,
                              city: e.target.value
                            }))}
                            required
                            disabled={submitting}
                            className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="City"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-2">
                            ZIP / Postal Code
                          </label>
                          <input
                            type="text"
                            value={shippingInfoState.zip}
                            onChange={handleZipChange}
                            required
                            disabled={submitting}
                            className={`w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed ${
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
                            value={shippingInfoState.country}
                            onChange={(value) => setShippingInfoState(prev => ({
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
                            disabled={submitting}
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
                              value={shippingInfoState.state || ''}
                              onChange={(value) => setShippingInfoState(prev => ({
                                ...prev,
                                state: value
                              }))}
                              options={availableStates.map(state => ({
                                value: state.name,
                                label: state.name,
                                secondaryLabel: state.code
                              }))}
                              required
                              disabled={submitting}
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
                            value={shippingInfoState.firstName}
                            onChange={(e) => setShippingInfoState(prev => ({
                              ...prev,
                              firstName: e.target.value
                            }))}
                            required
                            disabled={submitting}
                            className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="First name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-2">
                            Last Name
                          </label>
                          <input
                            type="text"
                            value={shippingInfoState.lastName}
                            onChange={(e) => setShippingInfoState(prev => ({
                              ...prev,
                              lastName: e.target.value
                            }))}
                            required
                            disabled={submitting}
                            className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          value={shippingInfoState.phoneNumber}
                          onChange={handlePhoneChange}
                          required
                          disabled={submitting}
                          className={`w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                            phoneError ? 'border-red-500' : ''
                          }`}
                          placeholder="+1234567890"
                        />
                        {phoneError && (
                          <p className="mt-1 text-sm text-red-500">{phoneError}</p>
                        )}
                      </div>

                      {/* Conditional Tax ID field for countries that require it */}
                      {shippingInfoState.country && doesCountryRequireTaxId(shippingInfoState.country) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-2">
                            Tax ID <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={shippingInfoState.taxId || ''}
                            onChange={(e) => setShippingInfoState(prev => ({
                              ...prev,
                              taxId: e.target.value
                            }))}
                            required
                            disabled={submitting}
                            className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="Enter your tax ID number"
                          />
                          <p className="mt-1 text-xs text-amber-400">
                            A tax ID is required for shipping to {shippingInfoState.country}
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Contact Method
                      </label>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <select
                          value={shippingInfoState.contactMethod}
                          onChange={(e) => setShippingInfoState(prev => ({
                            ...prev,
                            contactMethod: e.target.value,
                            contactValue: '' // Reset value when changing method
                          }))}
                          className="w-full sm:w-auto bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                          disabled={submitting}
                        >
                          <option value="telegram">Telegram</option>
                          <option value="email">Email</option>
                          <option value="x">X (Twitter)</option>
                        </select>
                        <div className="flex-1 min-w-0">
                          <input
                            type={shippingInfoState.contactMethod === 'email' ? 'email' : 'text'}
                            value={shippingInfoState.contactValue}
                            onChange={(e) => setShippingInfoState(prev => ({
                              ...prev,
                              contactValue: e.target.value
                            }))}
                            required
                            disabled={submitting}
                            className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500 truncate disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder={
                              shippingInfoState.contactMethod === 'telegram' ? '@username' :
                              shippingInfoState.contactMethod === 'email' ? 'email@example.com' :
                              '@handle'
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-800">
                      {/* Subtle coupon section */}
                      <div className="mb-4">
                        <button
                          type="button"
                          onClick={() => setShowCoupon(prev => !prev)}
                          className="text-gray-400 hover:text-gray-300 text-xs font-normal transition-colors"
                        >
                          {showCoupon ? 'Hide coupon code' : 'Have a coupon code?'}
                        </button>
                        
                        {showCoupon && (
                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              value={couponCode}
                              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                              className="block w-full rounded-md bg-gray-800 border border-gray-700 text-white text-sm px-3 py-1.5 placeholder-gray-500"
                              placeholder="Enter code"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  if (!walletAddress) {
                                    toast.error('Please connect your wallet first');
                                    return;
                                  }
                                  const result = await CouponService.calculateDiscount(
                                    baseModifiedPrice,
                                    couponCode,
                                    walletAddress,
                                    product.collectionId
                                  );
                                  setCouponResult(result);
                                  if (result.couponDiscount > 0) {
                                    toast.success('Coupon applied!');
                                  } else {
                                    toast.error(result.error || 'Invalid coupon code');
                                    setCouponResult(null);
                                  }
                                } catch (error) {
                                  console.error('Error applying coupon:', error);
                                  toast.error('Error applying coupon');
                                  setCouponResult(null);
                                }
                              }}
                              className="px-3 py-1.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded-md text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap"
                            >
                              Apply
                            </button>
                          </div>
                        )}

                        {/* Show discount if applied */}
                        {couponResult && couponResult.couponDiscount > 0 && (
                          <div className="mt-2 text-xs space-y-1">
                            <span className="text-primary font-medium">{couponResult.discountDisplay || `${couponResult.couponDiscount} SOL off`}</span>
                            <div className="text-gray-500">
                              Original price: {baseModifiedPrice.toFixed(2)} SOL
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Solana Payment Button - requires wallet verification */}
                      <button
                        type="button"
                        onClick={handlePaymentClick('solana')}
                        disabled={submitting || !verificationResult?.isValid || 
                          !shippingInfoState.address || !shippingInfoState.city || 
                          !shippingInfoState.country || !shippingInfoState.zip || 
                          (availableStates.length > 0 && !shippingInfoState.state) ||
                          !shippingInfoState.contactValue || !shippingInfoState.firstName ||
                          !shippingInfoState.lastName || !shippingInfoState.phoneNumber || 
                          (shippingInfoState.country && doesCountryRequireTaxId(shippingInfoState.country) && !shippingInfoState.taxId) ||
                          !!phoneError || !!zipError}
                        className="w-full bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <span>Pay with Solana ({finalPrice.toFixed(2)} SOL)</span>
                      </button>

                      <div className="mt-4 text-center">
                        {/* Credit Card Button - only requires shipping info */}
                        <button
                          type="button"
                          onClick={handlePaymentClick('stripe')}
                          disabled={submitting || 
                            !shippingInfoState.address || !shippingInfoState.city || 
                            !shippingInfoState.country || !shippingInfoState.zip || 
                            (availableStates.length > 0 && !shippingInfoState.state) ||
                            !shippingInfoState.contactValue || !shippingInfoState.firstName ||
                            !shippingInfoState.lastName || !shippingInfoState.phoneNumber || 
                            (shippingInfoState.country && doesCountryRequireTaxId(shippingInfoState.country) && !shippingInfoState.taxId) ||
                            !!phoneError || !!zipError}
                          className="text-primary hover:text-primary/80 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Pay with Credit Card
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}