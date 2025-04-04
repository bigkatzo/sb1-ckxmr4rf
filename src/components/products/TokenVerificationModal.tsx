import React, { useState, useEffect } from 'react';
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
import type { TransactionStatus } from '../../types/transactions';
import { OrderSuccessView } from '../OrderSuccessView';
import { validatePhoneNumber } from '../../lib/validation';
import { StripePaymentModal } from './StripePaymentModal';
import { CouponService } from '../../services/coupons';
import type { PriceWithDiscount } from '../../types/coupons';

interface TokenVerificationModalProps {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
  selectedOptions?: Record<string, string>;
}

interface ShippingInfo {
  address: string;
  city: string;
  country: string;
  zip: string;
  contactMethod: string;
  contactValue: string;
  fullName: string;
  phoneNumber: string;
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
  selectedOptions = {}
}: TokenVerificationModalProps) {
  const { walletAddress } = useWallet();
  const { processPayment } = usePayment();
  const [verifying, setVerifying] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { modifiedPrice } = useModifiedPrice({ product, selectedOptions });
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [showSuccessView, setShowSuccessView] = useState(false);
  const [orderDetails, setOrderDetails] = useState<{
    orderNumber: string;
    transactionSignature: string;
  } | null>(null);
  const [phoneError, setPhoneError] = useState<string>('');
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
  const updateProgressStep = (index: number, status: ProgressStep['status'], description?: string) => {
    setProgressSteps(steps => steps.map((step, i) => 
      i === index ? { ...step, status, description } : step
    ));
  };

  // Calculate final price including variants, modifications, and coupon
  const variantKey = Object.values(selectedOptions).join(':');
  const hasVariantPrice = 
    Object.keys(selectedOptions).length > 0 && 
    product.variantPrices && 
    variantKey in product.variantPrices;
  const baseModifiedPrice = hasVariantPrice ? product.variantPrices![variantKey] : modifiedPrice;
  const finalPrice = couponResult?.finalPrice ?? baseModifiedPrice;

  // Initialize shipping info from localStorage if available
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>(() => {
    const savedInfo = localStorage.getItem(STORAGE_KEY);
    return savedInfo ? JSON.parse(savedInfo) : {
      address: '',
      city: '',
      country: '',
      zip: '',
      contactMethod: 'telegram',
      contactValue: '',
      fullName: '',
      phoneNumber: ''
    };
  });

  // Save shipping info to localStorage whenever it changes
  useEffect(() => {
    console.log('Shipping info updated:', shippingInfo);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shippingInfo));
  }, [shippingInfo]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) return;

    let orderId: string | null = null;
    let signature: string | null = null;

    try {
      setSubmitting(true);

      // Format shipping info for database
      const formattedShippingInfo = {
        shipping_address: {
          address: shippingInfo.address,
          city: shippingInfo.city,
          country: shippingInfo.country,
          zip: shippingInfo.zip
        },
        contact_info: {
          method: shippingInfo.contactMethod,
          value: shippingInfo.contactValue,
          fullName: shippingInfo.fullName,
          phoneNumber: shippingInfo.phoneNumber
        }
      };

      // Format variant selections for database
      const formattedVariantSelections = Object.entries(selectedOptions).map(([variantId, value]) => {
        // Find the variant name from product.variants
        const variant = product.variants?.find(v => v.id === variantId);
        return {
          name: variant?.name || variantId, // Use variant name, fallback to variant ID
          value: value
        };
      });

      // Add coupon information if applied
      const paymentMetadata = {
        couponCode: couponResult?.couponDiscount ? couponCode : undefined,
        originalPrice: couponResult?.originalPrice,
        couponDiscount: couponResult?.couponDiscount
      };

      // Check if it's a 100% discount
      const is100PercentDiscount = couponResult?.couponDiscount && 
        couponResult.originalPrice && 
        couponResult.couponDiscount >= couponResult.originalPrice;

      if (is100PercentDiscount) {
        try {
          setSubmitting(true);
          // For 100% discount, create order directly without payment
          updateProgressStep(0, 'processing', 'Creating your free order...');
        
          const { data: createdOrderId, error: createError } = await supabase.rpc('create_order', {
            p_product_id: product.id,
            p_variants: formattedVariantSelections,
            p_shipping_info: formattedShippingInfo,
            p_wallet_address: walletAddress,
            p_payment_metadata: paymentMetadata
          });

          if (createError) throw createError;
          orderId = createdOrderId;
          updateProgressStep(0, 'completed');

          // Generate unique transaction signature for free orders
          updateProgressStep(1, 'processing', 'Processing free order...');
          const uniqueSignature = `free_order_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

          // Update order with unique transaction signature for free orders
          const { error: updateError } = await supabase.rpc('update_order_transaction', {
            p_order_id: orderId,
            p_transaction_signature: uniqueSignature,
            p_amount_sol: 0
          });

          if (updateError) throw updateError;
          updateProgressStep(1, 'completed');

          // Confirm the order immediately since it's free
          updateProgressStep(2, 'processing', 'Confirming order...');
          const { error: confirmError } = await supabase.rpc('confirm_order_transaction', {
            p_order_id: orderId
          });

          if (confirmError) throw confirmError;

          // Fetch order number
          const { data: orderData, error: fetchError } = await supabase
            .from('orders')
            .select('order_number')
            .eq('id', orderId)
            .single();

          if (fetchError) throw fetchError;

          updateProgressStep(2, 'completed');

          // Show toast notification
          toastService.showOrderSuccess();
        
          // Wait 1 second to show the completed progress state
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Show success
          setOrderDetails({
            orderNumber: orderData.order_number,
            transactionSignature: uniqueSignature
          });
          setShowSuccessView(true);
          onSuccess();
          return;
        } catch (error) {
          console.error('Free order error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to process free order';
          toast.error(errorMessage, {
            autoClose: false
          });
          setSubmitting(false);
          return;
        }
      }

      // Regular payment flow for non-100% discounts
      updateProgressStep(0, 'processing', 'Creating your order...');
      
      // Retry order creation up to 3 times
      for (let i = 0; i < 3; i++) {
        try {
          const { data: order, error } = await supabase.rpc('create_order', {
            p_product_id: product.id,
            p_variants: formattedVariantSelections,
            p_shipping_info: formattedShippingInfo,
            p_wallet_address: walletAddress,
            p_payment_metadata: paymentMetadata // Add payment metadata
          });

          if (error) throw error;
          orderId = order;
          updateProgressStep(0, 'completed');
          break;
        } catch (err) {
          console.error(`Order creation attempt ${i + 1} failed:`, err);
          if (i < 2) {
            updateProgressStep(0, 'processing', `Retrying order creation (attempt ${i + 2} of 3)...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
          } else {
            updateProgressStep(0, 'error', 'Failed to create order');
            throw err;
          }
        }
      }

      if (!orderId) {
        throw new Error('Failed to create order');
      }
      
      // Start payment processing
      updateProgressStep(1, 'processing', 'Initiating payment on Solana network...');
      
      // Process payment with modified price
      const { success, signature: txSignature } = await processPayment(finalPrice, product.collectionId);
      
      if (!success || !txSignature) {
        updateProgressStep(1, 'error', 'Payment failed');
        
        // Update order to pending_payment status even if payment fails
        try {
          const { error: updateError } = await supabase.rpc('update_order_transaction', {
            p_order_id: orderId,
            p_transaction_signature: 'rejected', // Use a special value for rejected transactions
            p_amount_sol: finalPrice
          });

          if (updateError) {
            console.error('Failed to update order status:', updateError);
          }
        } catch (err) {
          console.error('Error updating order status:', err);
        }
        
        throw new Error('Payment failed');
      }

      signature = txSignature;

      // Update order with transaction signature
      try {
        const { error: updateError } = await supabase.rpc('update_order_transaction', {
          p_order_id: orderId,
          p_transaction_signature: signature,
          p_amount_sol: finalPrice
        });

        if (updateError) throw updateError;
        
        // Payment initiated successfully
        updateProgressStep(1, 'completed');
        
        // Start transaction confirmation
        updateProgressStep(2, 'processing', 'Waiting for transaction confirmation...');
        
        // Wait for transaction confirmation
        const confirmed = await monitorTransaction(signature, (status: TransactionStatus) => {
          if (status.error) {
            updateProgressStep(2, 'error', status.error);
          }
        });

        if (!confirmed) {
          updateProgressStep(2, 'error', 'Transaction verification failed. Order will remain in pending_payment status for merchant review.');
          // Don't throw error here, let the merchant handle it
          setShowSuccessView(true); // Show success view since order is created
          return;
        }

        // Update order status to confirmed
        try {
          const { error: confirmError } = await supabase.rpc('confirm_order_transaction', {
            p_order_id: orderId
          });

          if (confirmError) {
            console.error('Failed to confirm order transaction:', confirmError);
            updateProgressStep(2, 'error', 'Transaction confirmed but failed to update order status. Please contact support.');
            return;
          }
        } catch (err) {
          console.error('Error confirming order transaction:', err);
          updateProgressStep(2, 'error', 'Transaction confirmed but failed to update order status. Please contact support.');
          return;
        }

        updateProgressStep(2, 'completed');

        // Get order number
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('order_number')
          .eq('id', orderId)
          .single();

        if (orderError) {
          console.error('Error fetching order number:', orderError);
          throw orderError;
        }

        // Show toast notification
        toastService.showOrderSuccess();
        
        // Wait 1 second to show the completed progress state
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Then transition to success view
        setOrderDetails({
          orderNumber: orderData.order_number,
          transactionSignature: signature
        });
        setShowSuccessView(true);
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
    setShippingInfo(prev => ({
      ...prev,
      phoneNumber: value
    }));
    
    const validation = validatePhoneNumber(value);
    setPhoneError(validation.error || '');
  };

  const handleStripeSuccess = async (orderId: string, paymentIntentId: string) => {
    // Get order number
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order number:', orderError);
      toast.error('Payment successful but failed to fetch order details');
      return;
    }

    // Show success view with order details
    setOrderDetails({
      orderNumber: orderData.order_number,
      transactionSignature: paymentIntentId
    });
    setShowStripeModal(false);
    setShowSuccessView(true);
    toastService.showOrderSuccess();
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
                step.status === 'processing' ? 'bg-purple-500/50 animate-pulse' :
                'bg-gray-700'
              }`} />
            )}
            
            <div className={`relative flex items-start gap-4 transition-opacity duration-300 ${
              step.status === 'processing' ? 'opacity-100' : 'opacity-70'
            }`}>
              {/* Status indicator */}
              <div className={`relative flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                step.status === 'completed' ? 'bg-green-500/20 text-green-400 ring-2 ring-green-500/30' :
                step.status === 'processing' ? 'bg-purple-500/20 text-purple-400 ring-2 ring-purple-500/30 scale-110' :
                step.status === 'error' ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/30' :
                'bg-gray-700/50 text-gray-400'
              }`}>
                {step.status === 'completed' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : step.status === 'processing' ? (
                  <div className="relative">
                    <Loading type={LoadingType.ACTION} />
                    <div className="absolute inset-0 rounded-full animate-[ping_2s_ease-in-out_infinite]">
                      <div className="absolute inset-0 rounded-full bg-purple-500/30 animate-[ping_2s_ease-in-out_infinite_0.75s]" />
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
                    step.status === 'processing' ? 'text-purple-400' :
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
                    <p className="text-xs text-purple-400/80 animate-pulse">Processing...</p>
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

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/80 backdrop-blur-lg">
      {showSuccessView && orderDetails ? (
        <OrderSuccessView
          productName={product.name}
          collectionName={product.collectionName || 'Unknown Collection'}
          productImage={product.imageUrl}
          orderNumber={orderDetails.orderNumber}
          transactionSignature={orderDetails.transactionSignature}
          onClose={onSuccess}
          collectionSlug={product.collectionSlug || ''}
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
              address: shippingInfo.address,
              city: shippingInfo.city,
              country: shippingInfo.country,
              zip: shippingInfo.zip,
            },
            contact_info: {
              method: shippingInfo.contactMethod,
              value: shippingInfo.contactValue,
              fullName: shippingInfo.fullName,
              phoneNumber: shippingInfo.phoneNumber,
            }
          }}
          variants={Object.entries(selectedOptions).map(([variantId, value]) => {
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
              <form onSubmit={handleSubmit} className="space-y-4">
                {submitting ? (
                  <>
                    <ProgressIndicator />
                    <div className="pt-4 border-t border-gray-800">
                      <button
                        type="submit"
                        disabled
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
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
                          value={shippingInfo.address}
                          onChange={(e) => setShippingInfo(prev => ({
                            ...prev,
                            address: e.target.value
                          }))}
                          required
                          disabled={submitting}
                          className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Enter your street address"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-2">
                            City
                          </label>
                          <input
                            type="text"
                            value={shippingInfo.city}
                            onChange={(e) => setShippingInfo(prev => ({
                              ...prev,
                              city: e.target.value
                            }))}
                            required
                            disabled={submitting}
                            className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="City"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-2">
                            ZIP / Postal Code
                          </label>
                          <input
                            type="text"
                            value={shippingInfo.zip}
                            onChange={(e) => setShippingInfo(prev => ({
                              ...prev,
                              zip: e.target.value
                            }))}
                            required
                            disabled={submitting}
                            className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="ZIP code"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Country
                        </label>
                        <input
                          type="text"
                          value={shippingInfo.country}
                          onChange={(e) => setShippingInfo(prev => ({
                            ...prev,
                            country: e.target.value
                          }))}
                          required
                          disabled={submitting}
                          className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Country"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={shippingInfo.fullName}
                          onChange={(e) => setShippingInfo(prev => ({
                            ...prev,
                            fullName: e.target.value
                          }))}
                          required
                          disabled={submitting}
                          className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="Enter your full name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={shippingInfo.phoneNumber}
                          onChange={handlePhoneChange}
                          required
                          disabled={submitting}
                          className={`w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                            phoneError ? 'border-red-500' : ''
                          }`}
                          placeholder="+1234567890"
                        />
                        {phoneError && (
                          <p className="mt-1 text-sm text-red-500">{phoneError}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Contact Method
                      </label>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <select
                          value={shippingInfo.contactMethod}
                          onChange={(e) => setShippingInfo(prev => ({
                            ...prev,
                            contactMethod: e.target.value,
                            contactValue: '' // Reset value when changing method
                          }))}
                          className="w-full sm:w-auto bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          disabled={submitting}
                        >
                          <option value="telegram">Telegram</option>
                          <option value="email">Email</option>
                          <option value="x">X (Twitter)</option>
                        </select>
                        <div className="flex-1 min-w-0">
                          <input
                            type={shippingInfo.contactMethod === 'email' ? 'email' : 'text'}
                            value={shippingInfo.contactValue}
                            onChange={(e) => setShippingInfo(prev => ({
                              ...prev,
                              contactValue: e.target.value
                            }))}
                            required
                            disabled={submitting}
                            className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 truncate disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder={
                              shippingInfo.contactMethod === 'telegram' ? '@username' :
                              shippingInfo.contactMethod === 'email' ? 'email@example.com' :
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
                              className="block w-full rounded-md bg-gray-800 border border-gray-700 text-sm px-3 py-1.5 placeholder-gray-500"
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
                                    walletAddress
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
                            <span className="text-purple-400 font-medium">{couponResult.discountDisplay || `${couponResult.couponDiscount} SOL off`}</span>
                            <div className="text-gray-500">
                              Original price: {baseModifiedPrice.toFixed(2)} SOL
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Solana Payment Button - requires wallet verification */}
                      <button
                        type="submit"
                        disabled={submitting || !verificationResult?.isValid || 
                          !shippingInfo.address || !shippingInfo.city || 
                          !shippingInfo.country || !shippingInfo.zip || 
                          !shippingInfo.contactValue || !shippingInfo.fullName ||
                          !shippingInfo.phoneNumber || !!phoneError}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <span>Pay with Solana ({finalPrice.toFixed(2)} SOL)</span>
                      </button>

                      <div className="mt-4 text-center">
                        {/* Credit Card Button - only requires shipping info */}
                        <button
                          type="button"
                          onClick={() => setShowStripeModal(true)}
                          disabled={submitting || 
                            !shippingInfo.address || !shippingInfo.city || 
                            !shippingInfo.country || !shippingInfo.zip || 
                            !shippingInfo.contactValue || !shippingInfo.fullName ||
                            !shippingInfo.phoneNumber || !!phoneError}
                          className="text-purple-400 hover:text-purple-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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