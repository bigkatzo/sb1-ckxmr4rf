import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useTokenPrices } from '../../hooks/useTokenPrices';

interface TokenVerificationModalProps {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
  selectedOption?: Record<string, string>;
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
  selectedOption = {}
}: TokenVerificationModalProps) {
  const { walletAddress, walletAuthToken, ensureAuthenticated } = useWallet();
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
  const [selectedToken, setSelectedToken] = useState<string>(product.pricingToken || 'SOL');
  const { convertSolToUsdc, convertUsdcToSol, convertToken } = useTokenPrices();
  
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

  // Determine available payment tokens based on product configuration
  const availableTokens = product.acceptedTokens || ['SOL'];

  // Get the final price based on the product's pricing token and the selected payment token
  const getFinalPriceInSelectedToken = useCallback(async (): Promise<number> => {
    // Start with the base modified price (possibly with coupon applied)
    const basePrice = couponResult ? couponResult.finalPrice : baseModifiedPrice;
    
    // If the selected token matches the pricing token, return the price as is
    if (selectedToken === (product.pricingToken || 'SOL')) {
      return basePrice;
    }
    
    // Otherwise, convert the price to the selected token using on-chain data
    try {
      return await convertToken(
        basePrice,
        product.pricingToken || 'SOL',
        selectedToken
      );
    } catch (error) {
      console.error('Error converting token price:', error);
      
      // Fallback to basic conversion if on-chain conversion fails
      if (selectedToken === 'USDC' && (product.pricingToken || 'SOL') === 'SOL') {
        return convertSolToUsdc(basePrice);
      } else if (selectedToken === 'SOL' && product.pricingToken === 'USDC') {
        return convertUsdcToSol(basePrice);
      }
      
      // Default fallback
      return basePrice;
    }
  }, [baseModifiedPrice, convertSolToUsdc, convertToken, convertUsdcToSol, couponResult, product.pricingToken, selectedToken]);
  
  // Calculate and cache the converted price (with loading state)
  const [convertedPrice, setConvertedPrice] = useState<number | null>(null);
  const [convertedPriceLoading, setConvertedPriceLoading] = useState(false);
  
  // Update the converted price when dependencies change
  useEffect(() => {
    const updateConvertedPrice = async () => {
      setConvertedPriceLoading(true);
      try {
        const price = await getFinalPriceInSelectedToken();
        setConvertedPrice(price);
      } catch (error) {
        console.error('Error calculating converted price:', error);
      } finally {
        setConvertedPriceLoading(false);
      }
    };
    
    updateConvertedPrice();
  }, [getFinalPriceInSelectedToken]);
  
  // Get formatted price string based on token
  const getFormattedPrice = (amount: number, token: string) => {
    return amount.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: token === 'USDC' ? 2 : 8 
    });
  };

  // Calculate final price including variants, modifications, and coupon
  const finalPrice = convertedPrice !== null ? convertedPrice : 0;

  // Initialize shipping info from localStorage if available
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>(() => {
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
    const countryCode = countries.find(c => c.name === shippingInfo.country)?.code;
    return countryCode ? getStatesByCountryCode(countryCode) : [];
  }, [shippingInfo.country]);

  // Enhance the handleZipChange function to detect country when possible
  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZip = e.target.value;
    setShippingInfo(prev => ({
      ...prev,
      zip: newZip
    }));
    
    // Clear any previous errors
    setZipError('');

    if (!newZip || newZip.length < 4) {
      return; // Skip validation for very short ZIPs
    }
    
    // If the country is already set, use that for validation
    if (shippingInfo.country) {
      const countryObj = countries.find(c => c.name === shippingInfo.country);
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
            if (stateName && (!shippingInfo.state || shippingInfo.state !== stateName)) {
              setShippingInfo(prev => ({
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
    else if (!shippingInfo.country && newZip.length >= 5) {
      const locationInfo = getLocationFromZip(newZip);
      
      if (locationInfo) {
        setShippingInfo(prev => ({
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
    console.log('Shipping info updated:', shippingInfo);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shippingInfo));
  }, [shippingInfo]);

  // Validate phone number on initial load
  useEffect(() => {
    if (shippingInfo.phoneNumber) {
      const validation = validatePhoneNumber(shippingInfo.phoneNumber);
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

  // Add a function to ensure wallet is authenticated before critical operations
  const ensureWalletAuth = useCallback(async () => {
    const isAuthenticated = await ensureAuthenticated();
    if (!isAuthenticated) {
      console.warn('Wallet authentication required for checkout');
      toast.warn('Please verify your wallet to continue', { 
        position: 'bottom-center'
      });
      return false;
    }
    return true;
  }, [ensureAuthenticated]);

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number before submission
    const phoneValidation = validatePhoneNumber(shippingInfo.phoneNumber);
    if (phoneValidation.error) {
      setPhoneError(phoneValidation.error);
      return;
    }
    
    // Validate ZIP code before submission
    const countryObj = countries.find(c => c.name === shippingInfo.country);
    const countryCode = countryObj?.code;
    const zipValidation = validateZipCode(shippingInfo.zip, countryCode);
    if (zipValidation.error) {
      setZipError(zipValidation.error);
      return;
    }
    
    // Validate state/province is selected if available for country
    if (availableStates.length > 0 && !shippingInfo.state) {
      toast.error('Please select a state/province');
      return;
    }
    
    if (selectedOption === null) {
      toast.error("Please select an option");
      return;
    }
    
    // Ensure wallet is authenticated
    const isAuthenticated = await ensureWalletAuth();
    if (!isAuthenticated) return;

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
          zip: shippingInfo.zip,
          state: shippingInfo.state || undefined,
          taxId: shippingInfo.taxId || undefined
        },
        contact_info: {
          method: shippingInfo.contactMethod,
          value: shippingInfo.contactValue,
          firstName: shippingInfo.firstName,
          lastName: shippingInfo.lastName,
          phoneNumber: shippingInfo.phoneNumber
        }
      };

      // Format variant selections for database
      const formattedVariantSelections = Object.entries(selectedOption).map(([variantId, value]) => {
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
          // For 100% discount, use the create-payment-intent endpoint with a flag for SOL free orders
          updateProgressStep(0, 'processing', 'Creating your free order...');
          
          // Generate a consistent transaction ID for free orders to prevent duplicates
          const transactionId = `free_token_${product.id}_${couponResult?.couponCode || 'nocoupon'}_${walletAddress || ''}_${Date.now()}`;
          
          let response;
          let responseData;
          let maxRetries = 2;
          let currentRetry = 0;
          let success = false;
          
          // Add retry logic for handling potential race conditions
          while (!success && currentRetry <= maxRetries) {
            try {
              // Call the create-payment-intent with the free order flag
              response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.createPaymentIntent}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  solAmount: 0, // Free order
                  solPrice: 1, // Placeholder value
                  productName: product.name,
                  productId: product.id,
                  variants: formattedVariantSelections,
                  shippingInfo: formattedShippingInfo,
                  walletAddress,
                  couponCode: couponResult?.couponCode,
                  couponDiscount: couponResult?.couponDiscount,
                  originalPrice: couponResult?.originalPrice,
                  paymentMetadata: {
                    ...paymentMetadata,
                    paymentMethod: 'free_sol',
                    transactionId,
                    orderSource: 'token_modal'
                  }
                })
              });
              
              const responseText = await response.text();
              try {
                responseData = JSON.parse(responseText);
                console.log('Free order server response:', responseData);
                
                // Handle duplicate orders gracefully - they're not an error
                if (responseData.isDuplicate) {
                  console.log('Server returned existing order:', responseData);
                  success = true;
                  break;
                }
                
                if (response.ok) {
                  success = true;
                  break;
                } else {
                  // If it's a duplicate key constraint, it's actually a success case
                  if (responseData.details && responseData.details.includes('duplicate key value')) {
                    console.log('Duplicate order detected by database constraint, treating as success');
                    // Try to extract the order ID from the error message if possible
                    success = true;
                    
                    // Try to get the order details from the database directly as a fallback
                    try {
                      const { data: orderBySignature } = await supabase
                        .from('orders')
                        .select('id')
                        .eq('transaction_signature', `free_${transactionId}`)
                        .single();
                        
                      if (orderBySignature) {
                        responseData = {
                          orderId: orderBySignature.id,
                          paymentIntentId: `free_${transactionId}`,
                          isFreeOrder: true,
                          isDuplicate: true
                        };
                        console.log('Found duplicate order in database:', responseData);
                      }
                    } catch (dbErr) {
                      console.error('Error looking up duplicate order:', dbErr);
                    }
                    break;
                  }
                  
                  throw new Error(responseData.error || 'Server returned an error');
                }
              } catch (parseError) {
                console.error('Error parsing server response:', parseError, responseText);
                throw new Error(`Invalid server response: ${responseText}`);
              }
            } catch (fetchError) {
              currentRetry++;
              console.warn(`Attempt ${currentRetry}/${maxRetries} failed:`, fetchError);
              if (currentRetry <= maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry));
                updateProgressStep(0, 'processing', `Retrying order creation (attempt ${currentRetry + 1}/${maxRetries + 1})...`);
              } else {
                throw fetchError;
              }
            }
          }
          
          if (!success || !responseData) {
            throw new Error('Failed to create free order after multiple attempts');
          }
          
          console.log('Free order processed successfully:', responseData);
          
          orderId = responseData.orderId;
          const uniqueSignature = responseData.paymentIntentId;
          
          // Update progress steps
          updateProgressStep(0, 'completed');
          updateProgressStep(1, 'completed');
          updateProgressStep(2, 'completed');

          // Helper function to consistently show success - can be called from multiple places
          const showSuccessWithFallback = (orderNum: string, txSignature: string) => {
            // Don't check successTriggered here, we'll use the component state
            setOrderDetails({
              orderNumber: orderNum,
              transactionSignature: txSignature
            });
            setShowSuccessView(true);
            toastService.showOrderSuccess();
            onSuccess();
          };

          // Try to get order number but use fallback if needed
          try {
            console.log(`Attempting to fetch order details for order ID: ${orderId}`);
            
            // Use auth-aware fetch to get order details
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            if (!supabaseUrl || !supabaseKey) {
              throw new Error('Supabase URL or key not found');
            }
            
            if (!orderId) {
              throw new Error('Order ID is missing');
            }
            
            // First attempt: Try using a direct RPC function that doesn't rely on RLS
            try {
              const headers: HeadersInit = {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
              };
              
              // Add wallet headers if available
              if (walletAddress) {
                headers['X-Wallet-Address'] = walletAddress;
              }
              
              if (walletAuthToken) {
                headers['X-Wallet-Auth-Token'] = walletAuthToken;
              }
              
              const response = await fetch(
                `${supabaseUrl}/rest/v1/rpc/get_order_by_id`,
                {
                  method: 'POST',
                  headers: headers,
                  body: JSON.stringify({ order_id: orderId })
                }
              );
              
              if (response.ok) {
                const orderData = await response.json();
                if (orderData && orderData.order_number) {
                  showSuccessWithFallback(orderData.order_number, uniqueSignature);
                  return;
                }
              }
            } catch (rpcError) {
              console.warn('RPC method failed, falling back to alternative method:', rpcError);
            }
            
            // Second attempt: Try direct orders table access with service key
            try {
              const headers: HeadersInit = {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
              };
              
              // Add wallet headers if available
              if (walletAddress) {
                headers['X-Wallet-Address'] = walletAddress;
              }
              
              if (walletAuthToken) {
                headers['X-Wallet-Auth-Token'] = walletAuthToken;
              }
              
              const response = await fetch(
                `${supabaseUrl}/rest/v1/orders?id=eq.${orderId}&select=order_number`,
                {
                  method: 'GET',
                  headers: headers
                }
              );
              
              if (response.ok) {
                const orderData = await response.json();
                
                if (Array.isArray(orderData) && orderData.length > 0 && orderData[0].order_number && orderId) {
                  // Use the order number from the response
                  showSuccessWithFallback(orderData[0].order_number, uniqueSignature);
                  return;
                }
              } else {
                console.warn(`Second attempt failed with status: ${response.status}`);
              }
            } catch (secondAttemptError) {
              console.warn('Second attempt failed:', secondAttemptError);
            }
            
            // If we get here and success hasn't been triggered, use fallback
            if (!showSuccessView) {
              console.warn('API calls completed but success not triggered yet, using fallback');
              const fallbackOrderNumber = `ORD-${Date.now().toString(36)}-${orderId?.substring(0, 6) || 'unknown'}`;
              showSuccessWithFallback(fallbackOrderNumber, uniqueSignature);
            }
          } catch (err) {
            console.error('Error fetching order details:', err);
            
            // Use fallback order number if an error occurs
            const fallbackOrderNumber = `ORD-${Date.now().toString(36)}-${orderId?.substring(0, 6) || 'unknown'}`;
            showSuccessWithFallback(fallbackOrderNumber, uniqueSignature);
          }
        } catch (error) {
          console.error('Free order error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Failed to process free order';
          toast.error(errorMessage, {
            autoClose: false
          });
          setSubmitting(false);
        }
      }

      // Regular payment flow for non-100% discounts
      updateProgressStep(0, 'processing', 'Creating your order...');
      
      // Retry order creation up to 3 times
      for (let i = 0; i < 3; i++) {
        try {
          const response = await fetch('/.netlify/functions/create-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              productId: product.id,
              variants: formattedVariantSelections,
              shippingInfo: formattedShippingInfo,
              walletAddress,
              paymentMetadata
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create order');
          }

          const data = await response.json();
          orderId = data.orderId;
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
      updateProgressStep(1, 'processing', `Initiating ${selectedToken} payment on Solana network...`);
      
      // Calculate the final price in the selected token
      const finalPrice = convertedPrice ?? await getFinalPriceInSelectedToken();
      
      // Process payment with modified price and selected token
      const { success: paymentSuccess, signature: txSignature } = 
        await processPayment(finalPrice, product.collectionId || '');
      
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

      signature = txSignature;

      // Update order with transaction signature
      try {
        const updateResponse = await fetch('/.netlify/functions/update-order-transaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            orderId,
            transactionSignature: signature,
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
          recipient: product.collectionId || '' // Collection address as recipient
        };
        
        // Monitor transaction status and confirm on chain
        const transactionSuccess = await monitorTransaction(
          signature,
          (status) => {
            console.log('Transaction status update:', status);
            if (status.error) {
              updateProgressStep(2, 'error', undefined, status.error);
            } else if (status.paymentConfirmed) {
              updateProgressStep(2, 'completed', 'Transaction confirmed!');
              
              // Add immediate success trigger when paymentConfirmed is true
              console.log('Payment confirmed, triggering success view');
              // Get fallback order number in case the normal flow fails
              const fallbackOrderNumber = `ORD-${Date.now().toString(36)}-${orderId?.substring(0, 6) || 'unknown'}`;
              
              // Important: Force full sequence order, use functional state update
              setOrderDetails({
                orderNumber: fallbackOrderNumber,
                transactionSignature: signature || ''
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
              const fallbackOrderNumber = `ORD-${Date.now().toString(36)}-${orderId?.substring(0, 6) || 'unknown'}`;
              setOrderDetails({
                orderNumber: fallbackOrderNumber,
                transactionSignature: signature || ''
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
          
          // Create fallback order details for the success view
          const fallbackOrderNumber = `ORD-${Date.now().toString(36)}-${orderId?.substring(0, 6) || 'unknown'}`;
          
          // Force reliable state update sequence
          setOrderDetails({
            orderNumber: fallbackOrderNumber,
            transactionSignature: signature || ''
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
    setShippingInfo(prev => ({
      ...prev,
      phoneNumber: value
    }));
    
    const validation = validatePhoneNumber(value);
    setPhoneError(validation.error || '');
  };

  const handleStripeSuccess = async (orderId: string, paymentIntentId: string) => {
    try {
      console.log('Stripe payment successful:', { orderId, paymentIntentId });
      
      // Create a proper order details object 
      const fallbackOrderNumber = `ORD-${Date.now().toString(36)}-${orderId?.substring(0, 6) || 'unknown'}`;
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
      const fallbackOrderNumber = `ORD-${Date.now().toString(36)}-${orderId?.substring(0, 6) || 'unknown'}`;
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
              firstName: shippingInfo.firstName,
              lastName: shippingInfo.lastName,
              phoneNumber: shippingInfo.phoneNumber,
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            onChange={handleZipChange}
                            required
                            disabled={submitting}
                            className={`w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed ${
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
                            value={shippingInfo.country}
                            onChange={(value) => setShippingInfo(prev => ({
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
                              value={shippingInfo.state || ''}
                              onChange={(value) => setShippingInfo(prev => ({
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
                            value={shippingInfo.firstName}
                            onChange={(e) => setShippingInfo(prev => ({
                              ...prev,
                              firstName: e.target.value
                            }))}
                            required
                            disabled={submitting}
                            className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="First name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-2">
                            Last Name
                          </label>
                          <input
                            type="text"
                            value={shippingInfo.lastName}
                            onChange={(e) => setShippingInfo(prev => ({
                              ...prev,
                              lastName: e.target.value
                            }))}
                            required
                            disabled={submitting}
                            className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

                      {/* Conditional Tax ID field for countries that require it */}
                      {shippingInfo.country && doesCountryRequireTaxId(shippingInfo.country) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-2">
                            Tax ID <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={shippingInfo.taxId || ''}
                            onChange={(e) => setShippingInfo(prev => ({
                              ...prev,
                              taxId: e.target.value
                            }))}
                            required
                            disabled={submitting}
                            className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="Enter your tax ID number"
                          />
                          <p className="mt-1 text-xs text-amber-400">
                            A tax ID is required for shipping to {shippingInfo.country}
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
                                    product.collectionId || ''
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

                      {/* Add token selection buttons to the payment form */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-white mb-2">
                          Select Payment Token
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {availableTokens.map(token => (
                            <button
                              key={token}
                              type="button"
                              onClick={() => setSelectedToken(token)}
                              className={`flex items-center justify-center px-4 py-2 rounded-lg border transition-colors ${
                                selectedToken === token
                                  ? 'bg-purple-600 border-purple-500 text-white'
                                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {token}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Solana Payment Button - requires wallet verification */}
                      <button
                        type="submit"
                        disabled={submitting || !verificationResult?.isValid || 
                          !shippingInfo.address || !shippingInfo.city || 
                          !shippingInfo.country || !shippingInfo.zip || 
                          (availableStates.length > 0 && !shippingInfo.state) ||
                          !shippingInfo.contactValue || !shippingInfo.firstName ||
                          !shippingInfo.lastName || !shippingInfo.phoneNumber || 
                          (shippingInfo.country && doesCountryRequireTaxId(shippingInfo.country) && !shippingInfo.taxId) ||
                          !!phoneError || !!zipError || convertedPriceLoading}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <span>
                          {convertedPriceLoading 
                            ? `Calculating ${selectedToken} price...` 
                            : `Pay with ${selectedToken} (${getFormattedPrice(convertedPrice ?? 0, selectedToken)} ${selectedToken})`}
                        </span>
                      </button>

                      <div className="mt-4 text-center">
                        {/* Credit Card Button - only requires shipping info */}
                        <button
                          type="button"
                          onClick={() => setShowStripeModal(true)}
                          disabled={submitting || 
                            !shippingInfo.address || !shippingInfo.city || 
                            !shippingInfo.country || !shippingInfo.zip || 
                            (availableStates.length > 0 && !shippingInfo.state) ||
                            !shippingInfo.contactValue || !shippingInfo.firstName ||
                            !shippingInfo.lastName || !shippingInfo.phoneNumber || 
                            (shippingInfo.country && doesCountryRequireTaxId(shippingInfo.country) && !shippingInfo.taxId) ||
                            !!phoneError || !!zipError}
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