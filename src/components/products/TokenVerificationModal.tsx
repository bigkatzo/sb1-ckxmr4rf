import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { verifyTokenHolding } from '../../utils/token-verification';
import { usePayment } from '../../hooks/usePayment';
import { createOrder } from '../../services/orders';
import { toast } from 'react-toastify';
import type { Product } from '../../types';

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
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    error?: string;
    balance?: number;
  } | null>(null);

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

      // If no category or no rules, user is eligible
      if (!product.category?.eligibilityRules?.rules?.length) {
        setVerificationResult({ isValid: true });
        setVerifying(false);
        return;
      }

      try {
        const tokenRules = product.category.eligibilityRules.rules.filter(
          rule => rule.type === 'token'
        );

        if (tokenRules.length === 0) {
          setVerificationResult({ isValid: true });
          setVerifying(false);
          return;
        }

        // Verify all token rules
        const results = await Promise.all(
          tokenRules.map(rule =>
            verifyTokenHolding(
              walletAddress,
              rule.value,
              rule.quantity || 1
            )
          )
        );

        // All rules must pass
        const isValid = results.every(result => result.isValid);
        const error = results.find(result => result.error)?.error;

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
      
      // Process payment first
      const { success, signature } = await processPayment(product.price, product.collectionId);
      
      if (!success || !signature) {
        throw new Error('Payment failed');
      }

      // Format shipping address
      const formattedShippingInfo = {
        address: `${shippingInfo.address}\n${shippingInfo.city}\n${shippingInfo.country}\n${shippingInfo.zip}`,
        contactMethod: shippingInfo.contactMethod,
        contactValue: shippingInfo.contactValue
      };

      // Create order record with retries
      let orderError;
      for (let i = 0; i < 3; i++) {
        try {
          await createOrder({
            productId: product.id,
            collectionId: product.collectionId,
            variants: Object.entries(selectedOptions).map(([id, value]) => ({
              name: product.variants?.find(v => v.id === id)?.name || '',
              value
            })),
            shippingInfo: formattedShippingInfo,
            transactionId: signature,
            walletAddress,
            amountSol: product.price
          });
          orderError = null;
          break;
        } catch (err) {
          console.error(`Order creation attempt ${i + 1} failed:`, err);
          orderError = err;
          if (i < 2) await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }

      if (orderError) throw orderError;

      onSuccess();
      toast.success('Order placed successfully!');
    } catch (error) {
      console.error('Order error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to place order';
      toast.error(errorMessage, {
        autoClose: false // Keep error visible until manually closed
      });
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-md">
        <div className="p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">Complete Your Purchase</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {/* Verification Status */}
          {product.category?.eligibilityRules?.rules?.length ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-800/50">
              {verifying ? (
                <>
                  <Loader2 className="h-5 w-5 text-purple-400 animate-spin" />
                  <span className="text-gray-100">Verifying eligibility...</span>
                </>
              ) : verificationResult?.isValid ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  <span className="text-gray-100">You are eligible to purchase this item!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="flex-1">
                    <p className="text-red-400">Not eligible</p>
                    {verificationResult?.error && (
                      <p className="text-sm text-gray-300 mt-1">{verificationResult.error}</p>
                    )}
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

          {/* Shipping Form */}
          {(!product.category?.eligibilityRules?.rules?.length || verificationResult?.isValid) && (
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
                    className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
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
                      className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
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
                      className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
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
                    className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
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
                      className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 truncate"
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
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing Payment...</span>
                    </>
                  ) : (
                    <>
                      <span>Proceed to Payment ({product.price} SOL)</span>
                    </>
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