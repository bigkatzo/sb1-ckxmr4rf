import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { verifyTokenHolding } from '../../utils/token-verification';
import { verifyWhitelistAccess } from '../../utils/whitelist-verification';
import { usePayment } from '../../hooks/usePayment';
import { createOrder } from '../../services/orders';
import { toast } from 'react-toastify';
import { toastService } from '../../services/toast';
import type { Product } from '../../types/variants';
import type { CategoryRule } from '../../types';
import { useModifiedPrice } from '../../hooks/useModifiedPrice';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { supabase } from '../../lib/supabase';

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

// Helper function to handle NFT verification
async function handleVerification(walletAddress: string, value: string, quantity: number): Promise<VerificationResult> {
  try {
    const { verifyNFTHolding } = await import('../../utils/nft-verification');
    return verifyNFTHolding(walletAddress, value, quantity);
  } catch (error) {
    console.error('Error loading verification module:', error);
    return { isValid: false, error: 'Failed to load verification module' };
  }
}

async function verifyRule(rule: CategoryRule, walletAddress: string): Promise<{ isValid: boolean; error?: string }> {
  switch (rule.type) {
    case 'token':
      return verifyTokenHolding(walletAddress, rule.value, rule.quantity || 1);
    case 'nft':
      return handleVerification(walletAddress, rule.value, rule.quantity || 1);
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
  
  // Add new state for progress steps
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([
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
    },
    { 
      label: 'Order Creation',
      status: 'pending',
      details: {
        success: 'Order successfully created',
        error: 'Failed to create order'
      }
    }
  ]);

  // Add helper function to update progress steps
  const updateProgressStep = (index: number, status: ProgressStep['status'], description?: string) => {
    setProgressSteps(steps => steps.map((step, i) => 
      i === index ? { ...step, status, description } : step
    ));
  };

  // Calculate final price including variants and modifications
  const variantKey = Object.values(selectedOptions).join(':');
  const hasVariantPrice = 
    Object.keys(selectedOptions).length > 0 && 
    product.variantPrices && 
    variantKey in product.variantPrices;
  const finalPrice = hasVariantPrice ? product.variantPrices![variantKey] : modifiedPrice;

  // Initialize shipping info from localStorage if available
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>(() => {
    const savedInfo = localStorage.getItem(STORAGE_KEY);
    return savedInfo ? JSON.parse(savedInfo) : {
      address: '',
      city: '',
      country: '',
      zip: '',
      contactMethod: 'telegram',
      contactValue: ''
    };
  });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    async function verifyAccess() {
      if (!walletAddress) {
        setVerificationResult({ isValid: false, error: 'Wallet not connected' });
        setVerifying(false);
        return;
      }

      // If no category or no rule groups, user is eligible
      if (!product.category?.eligibilityRules?.groups?.length) {
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
    
    if (!verificationResult?.isValid || 
        !shippingInfo.address || 
        !shippingInfo.city || 
        !shippingInfo.country || 
        !shippingInfo.zip || 
        !shippingInfo.contactValue ||
        !walletAddress) {
      return;
    }

    try {
      setSubmitting(true);
      
      // Save shipping info to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shippingInfo));
      
      // Update payment processing step
      updateProgressStep(0, 'processing');
      
      // Process payment with modified price
      const { success, signature } = await processPayment(finalPrice, product.collectionId);
      
      if (!success || !signature) {
        updateProgressStep(0, 'error', 'Payment failed');
        throw new Error('Payment failed');
      }
      
      updateProgressStep(0, 'completed');
      updateProgressStep(1, 'processing');

      // Format shipping address
      const formattedShippingInfo = {
        shipping_address: {
          address: shippingInfo.address,
          city: shippingInfo.city,
          country: shippingInfo.country,
          zip: shippingInfo.zip
        },
        contact_info: {
          method: shippingInfo.contactMethod,
          value: shippingInfo.contactValue
        }
      };

      // Format variant selections
      const formattedVariantSelections = product.variants && product.variants.length > 0
        ? Object.entries(selectedOptions)
            .filter(([_, value]) => value) // Only include non-empty selections
            .map(([id, value]) => {
              const variant = product.variants?.find(v => v.id === id);
              return {
                name: variant?.name || '',
                value
              };
            })
        : [];

      // Log variant information for debugging
      console.log('Creating order with variants:', {
        hasVariants: product.variants && product.variants.length > 0,
        selectedOptions,
        formattedVariantSelections,
        finalPrice
      });

      // Create order record with retries
      updateProgressStep(2, 'processing');
      let orderError;
      for (let i = 0; i < 3; i++) {
        try {
          await createOrder({
            productId: product.id,
            collectionId: product.collectionId,
            variant_selections: formattedVariantSelections,
            shippingInfo: formattedShippingInfo,
            transactionId: signature,
            walletAddress,
            amountSol: finalPrice
          });
          orderError = null;
          updateProgressStep(2, 'completed');
          break;
        } catch (err) {
          console.error(`Order creation attempt ${i + 1} failed:`, err);
          orderError = err;
          if (i < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
          } else {
            updateProgressStep(2, 'error', 'Failed to create order');
          }
        }
      }

      if (orderError) {
        // If order creation failed but payment succeeded, mark the transaction as 'order_failed'
        console.error('All order creation attempts failed:', orderError);
        
        try {
          // Update transaction status to 'order_failed' so it appears in the recovery view
          const { error: updateError } = await supabase.rpc('update_transaction_status', {
            p_signature: signature,
            p_status: 'order_failed',
            p_error_message: orderError instanceof Error ? orderError.message : 'Order creation failed'
          });
          
          if (updateError) {
            // This is expected if the migration hasn't been applied yet
            console.error('Failed to update transaction status to order_failed (function may not be updated yet):', updateError);
          } else {
            console.log('Transaction status updated to order_failed');
          }
        } catch (updateErr) {
          // This is expected if the migration hasn't been applied yet
          console.error('Exception updating transaction status (function may not be updated yet):', updateErr);
        }
        
        toast.warning(
          'Your payment was successful, but we had trouble creating your order. Our team has been notified and will contact you soon.',
          { autoClose: false }
        );
        
        // Still consider this a success from the user's perspective since payment went through
        toastService.showOrderSuccess();
        onSuccess();
        return;
      }

      toastService.showOrderSuccess();
      onSuccess();
    } catch (error) {
      console.error('Order error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to place order';
      toast.error(errorMessage, {
        autoClose: false
      });
      setSubmitting(false);
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-md">
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

          {/* Progress Indicator (show when submitting) */}
          {submitting && <ProgressIndicator />}

          {/* Shipping Form */}
          {(!product.category?.eligibilityRules?.groups?.length || verificationResult?.isValid) && (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <button
                  type="submit"
                  disabled={submitting || !verificationResult?.isValid || 
                    !shippingInfo.address || !shippingInfo.city || 
                    !shippingInfo.country || !shippingInfo.zip || 
                    !shippingInfo.contactValue}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <span>Processing...</span>
                  ) : (
                    <span>Proceed to Payment ({finalPrice.toFixed(2)} SOL)</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}