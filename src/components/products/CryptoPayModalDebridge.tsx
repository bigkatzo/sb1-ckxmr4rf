import React from 'react';
import { X, ArrowRight, Check, Wallet, Coins, Globe } from 'lucide-react';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { useWallet } from '../../contexts/WalletContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Button } from '../ui/Button';
import { usePayment } from '../../hooks/usePayment';
import WormholeConnect from '@wormhole-foundation/wormhole-connect';

// ========== Type Definitions =============

type PaymentMethod = 'solana' | 'other-tokens' | 'cross-chain';
type PaymentStatus = 'selecting' | 'processing' | 'confirming' | 'succeeded' | 'error';

interface CryptoPaymentModalProps {
  onClose: () => void;
  onComplete: (
    status: any,
    txSignature: string,
    orderId?: string,
    batchOrderId?: string,
    receiverWallet?: string
  ) => void;
  totalAmount: number;
  productName: string;
  orderId?: string;
  batchOrderId?: string;
  couponCode?: string;
  couponDiscount?: number;
  originalPrice?: number;
  receiverWallet: string;
  fee?: number;
}

// =============== JUPITER Widget Unchanged ================
// Insert your JupiterWidget implementation here; unchanged
// Jupiter Widget Component
function JupiterWidget({ 
  totalAmount, 
  receiverWallet,
  onComplete,
  orderId,
  batchOrderId,
  setPaymentStatus,
  setError
}: {
  totalAmount: number;
  receiverWallet: string;
  onComplete: (status: any, txSignature: string, orderId?: string, batchOrderId?: string, receiverWallet?: string) => void;
  orderId?: string;
  batchOrderId?: string;
  setPaymentStatus: (status: PaymentStatus) => void;
  setError: (error: string | null) => void;
}) {
  const [isJupiterLoaded, setIsJupiterLoaded] = React.useState(false);
  const [isJupiterInitialized, setIsJupiterInitialized] = React.useState(false);
  const [loadingError, setLoadingError] = React.useState(false);
  const { walletAddress } = useWallet();

  // Load Jupiter script
  React.useEffect(() => {
    const loadJupiter = async () => {
      try {
        // Check if script already exists
        const existingScript = document.querySelector('script[src*="terminal.jup.ag"]');
        if (existingScript && window.Jupiter) {
          setIsJupiterLoaded(true);
          return;
        }

        // Remove existing script if present
        if (existingScript) {
          existingScript.remove();
        }

        const script = document.createElement('script');
        script.src = 'https://terminal.jup.ag/main-v2.js';
        script.async = true;
        
        script.onload = () => {
          console.log('Jupiter script loaded successfully');
          setIsJupiterLoaded(true);
          setLoadingError(false);
        };
        
        script.onerror = () => {
          console.error('Failed to load Jupiter script');
          setLoadingError(true);
          setError('Failed to load Jupiter widget. Please refresh and try again.');
        };
        
        document.head.appendChild(script);
      } catch (error) {
        console.error('Error loading Jupiter:', error);
        setLoadingError(true);
        setError('Failed to initialize Jupiter widget');
      }
    };

    loadJupiter();
  }, [setError]);

  // Initialize Jupiter when script is loaded
  React.useEffect(() => {
    if (!isJupiterLoaded || !window.Jupiter || !walletAddress || isJupiterInitialized || loadingError) {
      return;
    }

    const initializeJupiter = async () => {
      try {
        console.log('Initializing Jupiter with wallet:', walletAddress);

        // Clear any existing Jupiter instance
        if (window.Jupiter?.close) {
          window.Jupiter.close();
        }

        // Initialize Jupiter
        window.Jupiter?.init({
          displayMode: 'integrated',
          integratedTargetId: 'jupiter-terminal',
          endpoint: 'https://api.mainnet-beta.solana.com',
          platformFeeAndAccounts: {
            feeBps: 0,
            feeAccounts: []
          },
          formProps: {
            fixedOutputMint: true,
            swapMode: 'ExactOut',
            initialAmount: (totalAmount * 1e9).toString(),
            initialInputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
            initialOutputMint: 'So11111111111111111111111111111111111111112', // SOL
            fixedAmount: true,
            strictTokenList: false,
            defaultExplorer: 'SolanaFM'
          },
          enableWalletPassthrough: true,
          onRequestConnectWallet: () => {
            console.log('Jupiter requesting wallet connection');
          },
          onSuccess: async ({ txid, swapResult }: any) => {
            console.log('Jupiter swap successful:', { txid, swapResult });
            setPaymentStatus('succeeded');
            
            onComplete(
              {
                success: true,
                swapResult: swapResult,
                outputAmount: totalAmount
              },
              txid,
              orderId,
              batchOrderId,
              receiverWallet
            );
          },
          onSwapError: ({ error }: any) => {
            console.error('Jupiter swap error:', error);
            setError(error?.message || 'Token swap failed');
            setPaymentStatus('error');
          },
          onFormUpdate: (form: any) => {
            console.log('Jupiter form updated:', form);
          },
          onScreenUpdate: (screen: any) => {
            console.log('Jupiter screen updated:', screen);
            if (screen === 'SwappingScreen') {
              setPaymentStatus('processing');
            }
          }
        });

        setIsJupiterInitialized(true);
      } catch (error) {
        console.error('Jupiter initialization error:', error);
        setError('Failed to initialize Jupiter widget');
        setLoadingError(true);
      }
    };

    // Initialize with a small delay
    const timer = setTimeout(initializeJupiter, 1000);
    return () => clearTimeout(timer);
  }, [isJupiterLoaded, walletAddress, totalAmount, receiverWallet, onComplete, orderId, batchOrderId, setPaymentStatus, setError, isJupiterInitialized, loadingError]);

  if (loadingError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-red-400 text-center">
          <p className="font-medium">Failed to load Jupiter widget</p>
          <p className="text-sm text-gray-400 mt-2">Please refresh the page and try again</p>
        </div>
        <Button
          onClick={() => window.location.reload()}
          variant="primary"
          size="sm"
        >
          Refresh Page
        </Button>
      </div>
    );
  }

  if (!isJupiterLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Loading type={LoadingType.ACTION} />
          <p className="text-gray-400 text-sm">Loading Jupiter widget...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Target Amount Card */}
      <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Coins className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-gray-300 text-sm font-medium">Target Amount</p>
              <p className="text-xs text-gray-400">Swap any token to SOL</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-xl font-semibold">
              {totalAmount.toFixed(4)} SOL
            </p>
            {/* <p className="text-gray-400 text-xs">
              ≈ ${(totalAmount * 100).toFixed(2)}
            </p> */}
          </div>
        </div>
      </div>
      
      {/* Jupiter Widget Container */}
      <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700/50 bg-gray-900/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              🪐
            </div>
            <div>
              <h3 className="text-white font-medium">Jupiter Token Swap</h3>
              <p className="text-gray-400 text-xs">Best routes across Solana DEXs</p>
            </div>
          </div>
        </div>
        
        <div className="p-4">
          <div 
            id="jupiter-terminal"
            className="w-full min-h-[500px] bg-gray-950/50 rounded-lg border border-gray-800"
          />

          {!isJupiterInitialized && isJupiterLoaded && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Loading type={LoadingType.ACTION} />
                <p className="text-gray-400 text-sm">Initializing Jupiter...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================ Wormhole Connect Widget ==================
function WormholeConnectWidget({
  totalAmount,
  receiverWallet,
  onComplete,
  orderId,
  batchOrderId,
  setPaymentStatus,
  setError,
}: {
  totalAmount: number;
  receiverWallet: string;
  onComplete: (
    status: any,
    txSignature: string,
    orderId?: string,
    batchOrderId?: string,
    receiverWallet?: string
  ) => void;
  orderId?: string;
  batchOrderId?: string;
  setPaymentStatus: (status: PaymentStatus) => void;
  setError: (err: string | null) => void;
}) {
  const [isComplete, setIsComplete] = React.useState(false);

  const handleComplete = React.useCallback(
    (info: any) => {
      setIsComplete(true);
      setPaymentStatus('succeeded');
      onComplete(
        {
          ...info,
          success: true,
          crossChain: true,
        },
        info?.transactionId || '', // txHash
        orderId,
        batchOrderId,
        receiverWallet
      );
    },
    [onComplete, orderId, batchOrderId, receiverWallet, setPaymentStatus]
  );

  // error handler: Wormhole Connect reports errors via its UI. For custom modal, listen to unhandledrejection as fallback.
  React.useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      setPaymentStatus('error');
      setError(
        e.reason?.message ||
          'Cross-chain payment failed. Please try another token or network.'
      );
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, [setPaymentStatus, setError]);

  return (
    <div className="space-y-6">
      {/* Target Amount Card */}
      <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-gray-300 text-sm font-medium">Cross-Chain Payment</p>
              <p className="text-xs text-gray-400">Bridge or swap from any supported network</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-xl font-semibold">
              {totalAmount.toFixed(4)} SOL
            </p>
          </div>
        </div>
        <div className="text-xs text-gray-400 bg-gray-800/50 rounded-lg p-3 mt-2">
          <span className="text-gray-300 font-medium">Destination:</span>{' '}
          {receiverWallet.slice(0, 8)}...{receiverWallet.slice(-8)}
        </div>
      </div>
      {/* Wormhole Connect UI */}
      <div className="bg-gray-900/40 p-4 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
        <WormholeConnect
          env="mainnet"
          targetChain="solana"
          targetAddress={receiverWallet}
          token="SOL"
          amount={Number(totalAmount).toString()}
          onComplete={handleComplete}
        />
        {isComplete && (
          <div className="mt-5 text-center text-green-400 text-sm">
            ✅ Cross-chain transfer completed!
          </div>
        )}
      </div>
    </div>
  );
}

// ================ Main Form Component ===========================

function CryptoPaymentForm({
  totalAmount,
  onComplete,
  couponDiscount = 0,
  originalPrice = 0,
  productName,
  orderId,
  batchOrderId,
  fee = 0,
  receiverWallet,
}: {
  totalAmount: number;
  onComplete: (
    status: any,
    txSignature: string,
    orderId?: string,
    batchOrderId?: string,
    receiverWallet?: string
  ) => void;
  couponDiscount?: number;
  originalPrice?: number;
  productName: string;
  orderId: string;
  batchOrderId: string;
  fee?: number;
  receiverWallet: string;
}) {
  const [selectedMethod, setSelectedMethod] =
    React.useState<PaymentMethod>('solana');
  const [paymentStatus, setPaymentStatus] =
    React.useState<PaymentStatus>('selecting');
  const [error, setError] = React.useState<string | null>(null);
  const [walletConnected, setWalletConnected] = React.useState(false);
  const [showWormholeWidget, setShowWormholeWidget] = React.useState(false);
  const [showJupiterWidget, setShowJupiterWidget] = React.useState(false);
  const { walletAddress, disconnect } = useWallet();
  const { processPayment } = usePayment();

  React.useEffect(() => {
    setWalletConnected(!!walletAddress);
  }, [walletAddress]);

  const isProcessing =
    paymentStatus === 'processing' || paymentStatus === 'confirming';

  // --- PAYMENT METHOD TOGGLE LOGIC ---
  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setError(null);
    setPaymentStatus('selecting');
    setShowJupiterWidget(false);
    setShowWormholeWidget(false);
    // Show widget if applicable
    if (method === 'cross-chain') setShowWormholeWidget(true);
    if (method === 'other-tokens') setShowJupiterWidget(true);
  };

  // --- BUTTON PAY LOGIC ---
  const handlePayment = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    setPaymentStatus('processing');
    setError(null);

    try {
      switch (selectedMethod) {
        case 'solana':
          await processSolanaPayment();
          break;
        case 'other-tokens':
          setError(
            'Please use the Jupiter widget below to complete your token swap.'
          );
          setPaymentStatus('selecting');
          break;
        case 'cross-chain':
          setError('Please use the Wormhole Connect widget below.');
          setPaymentStatus('selecting');
          break;
        default:
          throw new Error('Invalid payment method.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unexpected payment error.');
      setPaymentStatus('error');
    }
  };

  // --- PROCESS SOLANA ONLY PAYMENT ---
  const processSolanaPayment = async () => {
    setPaymentStatus('confirming');
    let cartId = orderId ?? batchOrderId;
    const { success: paymentSuccess, signature: txSignature } =
      await processPayment(totalAmount, cartId, receiverWallet);

    if (!paymentSuccess || !txSignature) {
      setError('Payment failed or was cancelled');
      setPaymentStatus('error');
      onComplete(
        { success: false },
        txSignature || '',
        orderId,
        batchOrderId,
        receiverWallet
      );
      return;
    }

    setPaymentStatus('succeeded');
    onComplete(
      { success: true },
      txSignature,
      orderId,
      batchOrderId,
      receiverWallet
    );
  };

  // --- NO PRICE DATA (loading) ---
  if (totalAmount === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-3">
          <Loading type={LoadingType.ACTION} />
          <p className="text-gray-400 text-sm">Loading price data...</p>
        </div>
      </div>
    );
  }

  // =================== JUPITER (OTHER TOKEN) WIDGET ==============
  if (showJupiterWidget) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => {
              setShowJupiterWidget(false);
              setSelectedMethod('solana');
              setPaymentStatus('selecting');
              setError(null);
            }}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            ← Back to Payment Methods
          </Button>
        </div>
        <JupiterWidget
          totalAmount={totalAmount}
          receiverWallet={receiverWallet}
          onComplete={onComplete}
          orderId={orderId}
          batchOrderId={batchOrderId}
          setPaymentStatus={setPaymentStatus}
          setError={setError}
        />
        {error && (
          <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <X className="h-3 w-3 text-white" />
              </div>
              <div>
                <p className="font-medium">Error</p>
                <p className="text-red-300 text-xs mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================== WORMHOLE CONNECT BRIDGE WIDGET ===================
  if (showWormholeWidget) {
    return (
      <div className="space-y-6">
        <Button
          onClick={() => {
            setShowWormholeWidget(false);
            setSelectedMethod('solana');
            setPaymentStatus('selecting');
            setError(null);
          }}
          variant="ghost"
          size="sm"
          className="text-gray-400 hover:text-white"
        >
          ← Back to Payment Methods
        </Button>
        <WormholeConnectWidget
          totalAmount={totalAmount}
          receiverWallet={receiverWallet}
          onComplete={onComplete}
          orderId={orderId}
          batchOrderId={batchOrderId}
          setPaymentStatus={setPaymentStatus}
          setError={setError}
        />
        {error && (
          <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <X className="h-3 w-3 text-white" />
              </div>
              <div>
                <p className="font-medium">Error</p>
                <p className="text-red-300 text-xs mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =================== MAIN PAYMENT SELECTION UI ==================

  return (
    <div className="space-y-6">
      {/* Price Card */}
      <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-gray-300 text-sm font-medium">Total Amount</p>
              <p className="text-xs text-gray-400">
                Live pricing with real-time SOL rate
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-2xl font-bold">
              {totalAmount.toFixed(4)} SOL
            </p>
            {couponDiscount > 0 && originalPrice > 0 && (
              <div className="text-sm mt-1">
                <span className="text-gray-400 line-through">
                  {originalPrice.toFixed(4)} SOL
                </span>
                <span className="text-purple-400 ml-2">Coupon applied</span>
              </div>
            )}
            <p className="text-gray-400 text-xs mt-1">
              ≈ ${(totalAmount * 100).toFixed(2)} USD
            </p>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="space-y-4">
        <h3 className="text-white font-semibold text-lg">
          Select Payment Method
        </h3>

        {/* Solana Payment */}
        <div
          onClick={() => handlePaymentMethodSelect('solana')}
          className={`group p-5 rounded-xl border cursor-pointer transition-all duration-200 ${
            selectedMethod === 'solana'
              ? 'border-purple-500/50 bg-purple-500/10 shadow-lg shadow-purple-500/20'
              : 'border-gray-700/50 bg-gray-900/40 hover:border-gray-600/50 hover:bg-gray-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                ◎
              </div>
              <div>
                <h4 className="text-white font-medium text-base">Pay with SOL</h4>
                <p className="text-sm text-gray-400 mt-1">
                  Direct Solana payment • Instant • Lowest fees
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedMethod === 'solana' && (
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              <ArrowRight
                className={`h-5 w-5 transition-transform ${
                  selectedMethod === 'solana'
                    ? 'text-purple-400'
                    : 'text-gray-400 group-hover:text-gray-300'
                }`}
              />
            </div>
          </div>
        </div>
        {/* Other Tokens w/ Jupiter Swaps */}
        <div
          onClick={() => handlePaymentMethodSelect('other-tokens')}
          className={`group p-5 rounded-xl border cursor-pointer transition-all duration-200 ${
            selectedMethod === 'other-tokens'
              ? 'border-blue-500/50 bg-blue-500/10 shadow-lg shadow-blue-500/20'
              : 'border-gray-700/50 bg-gray-900/40 hover:border-gray-600/50 hover:bg-gray-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                🪐
              </div>
              <div>
                <h4 className="text-white font-medium text-base">
                  Pay with Other Tokens
                </h4>
                <p className="text-sm text-gray-400 mt-1">
                  Swap any Solana token via Jupiter • Best rates
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedMethod === 'other-tokens' && (
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              <ArrowRight
                className={`h-5 w-5 transition-transform ${
                  selectedMethod === 'other-tokens'
                    ? 'text-blue-400'
                    : 'text-gray-400 group-hover:text-gray-300'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Cross-Chain via Wormhole */}
        <div
          onClick={() => handlePaymentMethodSelect('cross-chain')}
          className={`group p-5 rounded-xl border cursor-pointer transition-all duration-200 ${
            selectedMethod === 'cross-chain'
              ? 'border-green-500/50 bg-green-500/10 shadow-lg shadow-green-500/20'
              : 'border-gray-700/50 bg-gray-900/40 hover:border-gray-600/50 hover:bg-gray-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                🔗
              </div>
              <div>
                <h4 className="text-white font-medium text-base">
                  Pay from Any Network
                </h4>
                <p className="text-sm text-gray-400 mt-1">
                  Cross-chain payments via Wormhole • Multi-chain support
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedMethod === 'cross-chain' && (
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              <ArrowRight
                className={`h-5 w-5 transition-transform ${
                  selectedMethod === 'cross-chain'
                    ? 'text-green-400'
                    : 'text-gray-400 group-hover:text-gray-300'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* WALLET STATUS */}
      {!walletConnected && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Wallet className="h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <p className="text-yellow-400 font-medium text-sm">
                Wallet Required
              </p>
              <p className="text-yellow-300/80 text-xs mt-1">
                Please connect your wallet to continue with payment
              </p>
            </div>
          </div>
        </div>
      )}

      {walletConnected && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-green-400 font-medium text-sm">Wallet Connected</p>
                <p className="text-xs text-green-300/80 mt-1">
                  {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-8)}
                </p>
              </div>
            </div>
            <Button
              onClick={disconnect}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
            >
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {/* ERRORS */}
      {error && (
        <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded-xl border border-red-500/30">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <X className="h-3 w-3 text-white" />
            </div>
            <div>
              <p className="font-medium">Error</p>
              <p className="text-red-300 text-xs mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT BUTTON */}
      <Button
        onClick={handlePayment}
        variant="primary"
        size="lg"
        isLoading={isProcessing}
        loadingText={
          paymentStatus === 'processing'
            ? 'Initializing payment...'
            : paymentStatus === 'confirming'
            ? 'Confirming transaction...'
            : 'Processing...'
        }
        disabled={
          !walletConnected ||
          isProcessing ||
          ((selectedMethod === 'cross-chain' || selectedMethod === 'other-tokens') &&
            paymentStatus === 'selecting')
        }
        className="w-full h-14 text-base font-semibold rounded-xl"
      >
        {!walletConnected ? (
          'Connect Wallet to Continue'
        ) : selectedMethod === 'cross-chain' ? (
          <>
            Open Cross-Chain Payment
            <ArrowRight className="h-5 w-5 ml-2" />
          </>
        ) : selectedMethod === 'other-tokens' ? (
          <>
            Open Token Swap
            <ArrowRight className="h-5 w-5 ml-2" />
          </>
        ) : isProcessing ? (
          'Processing Payment...'
        ) : (
          <>
            Continue to Payment
            <ArrowRight className="h-5 w-5 ml-2" />
          </>
        )}
      </Button>

      {paymentStatus === 'confirming' && (
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Loading type={LoadingType.ACTION} />
            <span className="text-gray-400 text-sm">
              Waiting for transaction confirmation...
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Please approve the transaction in your wallet.
          </p>
        </div>
      )}
    </div>
  );
}

// ===================== MODAL EXPORT =====================

export function CryptoPaymentModal({
  onClose,
  onComplete,
  totalAmount,
  productName,
  orderId,
  batchOrderId,
  receiverWallet,
  couponDiscount = 0,
  originalPrice = 0,
  fee = 0,
}: CryptoPaymentModalProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
      <div className="relative max-w-2xl w-full bg-gray-900/95 rounded-2xl border border-gray-700/50 shadow-2xl my-8">
        <div className="p-6 border-b border-gray-700/50 flex justify-between items-center sticky top-0 bg-gray-900/95 z-10 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">Crypto Payment</h2>
            <p className="text-sm text-gray-400 mt-1">
              Secure payment with multiple options
            </p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white p-2 rounded-lg"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
          <ErrorBoundary
            fallback={
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                  <X className="h-8 w-8 text-red-400" />
                </div>
                <div>
                  <p className="text-red-400 font-medium">
                    Failed to load payment form
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    Please refresh the page and try again
                  </p>
                </div>
                <Button
                  onClick={() => window.location.reload()}
                  variant="primary"
                  className="mt-4"
                >
                  Refresh Page
                </Button>
              </div>
            }
          >
            <CryptoPaymentForm
              totalAmount={totalAmount}
              onComplete={onComplete}
              couponDiscount={couponDiscount}
              originalPrice={originalPrice}
              productName={productName}
              orderId={orderId || ''}
              batchOrderId={batchOrderId || ''}
              receiverWallet={receiverWallet}
              fee={fee}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
