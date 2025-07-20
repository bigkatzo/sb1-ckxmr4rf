import React from 'react';
import { X, ArrowRight, Check, Wallet, Coins, Globe } from 'lucide-react';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { useWallet } from '../../contexts/WalletContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Button } from '../ui/Button';
import { usePayment } from '../../hooks/usePayment';
import WormholeConnect from '@wormhole-foundation/wormhole-connect';

// Type definitions
declare global {
  interface Window {
    Jupiter?: {
      init: (config: any) => void;
      syncProps?: (props: any) => void;
      close?: () => void;
    };
  }
}

interface CryptoPaymentModalProps {
  onClose: () => void;
  onComplete: (status:any, txSignature: string, orderId?: string, batchOrderId?: string, receiverWallet?: string) => void;
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

type PaymentMethod = 'solana' | 'other-tokens' | 'cross-chain';
type PaymentStatus = 'selecting' | 'processing' | 'confirming' | 'succeeded' | 'error';

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

// Wormhole Widget Component
function WormholeWidget({
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
  onComplete: (status: any, txSignature: string, orderId?: string, batchOrderId?: string, receiverWallet?: string) => void;
  orderId?: string;
  batchOrderId?: string;
  setPaymentStatus: (status: PaymentStatus) => void;
  setError: (error: string | null) => void;
}) {
  const [isInitialized, setIsInitialized] = React.useState(false);

  React.useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Wormhole configuration
  const wormholeConfig: any = {
    network: 'Mainnet',
    chains: ['Ethereum', 'Solana', 'Polygon', 'Bsc', 'Avalanche', 'Base', 'Arbitrum', 'Optimism'],
    rpcs: {
      Solana: 'https://api.mainnet-beta.solana.com',
      Ethereum: 'https://rpc.ankr.com/eth',
      Polygon: 'https://polygon-rpc.com',
      Bsc: 'https://bsc-dataseed.binance.org/',
      Avalanche: 'https://api.avax.network/ext/bc/C/rpc',
      Base: 'https://mainnet.base.org',
      Arbitrum: 'https://arb1.arbitrum.io/rpc',
      Optimism: 'https://mainnet.optimism.io'
    },
    tokensConfig: {},
    routes: []
  };

  // Custom theme matching the existing design
  const wormholeTheme: any = {
    background: {
      default: '#0F172A'
    },
    primary: {
      50: '#F0F9FF',
      100: '#E0F2FE', 
      200: '#BAE6FD',
      300: '#7DD3FC',
      400: '#38BDF8',
      500: '#0EA5E9',
      600: '#0284C7',
      700: '#0369A1',
      800: '#075985',
      900: '#0C4A6E'
    },
    secondary: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A'
    },
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    text: {
      primary: '#FFFFFF',
      secondary: '#94A3B8'
    },
    button: {
      primary: '#8B5CF6',
      primaryText: '#FFFFFF',
      disabled: '#374151',
      disabledText: '#6B7280',
      action: '#8B5CF6',
      actionText: '#FFFFFF',
      hover: '#7C3AED'
    },
    options: {
      hover: '#1E293B',
      select: '#8B5CF6'
    },
    card: {
      background: '#1E293B',
      secondary: '#334155',
      elevation: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
    },
    popover: {
      background: '#1E293B',
      secondary: '#334155',
      elevation: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
    },
    modal: {
      background: '#0F172A'
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Loading type={LoadingType.ACTION} />
          <p className="text-gray-400 text-sm">Loading Wormhole Connect...</p>
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
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-gray-300 text-sm font-medium">Cross-Chain Payment</p>
              <p className="text-xs text-gray-400">Bridge from any supported network</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-xl font-semibold">
              {totalAmount.toFixed(4)} SOL
            </p>
          </div>
        </div>
        <div className="text-xs text-gray-400 bg-gray-800/50 rounded-lg p-3">
          <span className="text-gray-300 font-medium">Destination:</span> {receiverWallet.slice(0, 8)}...{receiverWallet.slice(-8)}
        </div>
      </div>

      {/* Wormhole Widget Container */}
      <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-700/50 bg-gray-900/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              🌉
            </div>
            <div>
              <h3 className="text-white font-medium">Wormhole Connect</h3>
              <p className="text-gray-400 text-xs">Secure cross-chain token transfers</p>
            </div>
          </div>
        </div>
        
        <div className="p-4">
          <div className="wormhole-widget-container min-h-[600px]">
            <WormholeConnect 
              config={wormholeConfig}
              theme={wormholeTheme}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CryptoPaymentForm({
  totalAmount,
  onComplete,
  couponDiscount,
  originalPrice,
  orderId,
  batchOrderId,
  fee,
  receiverWallet,
}: {
  totalAmount: number;
  onComplete: (status: any, txSignature: string, orderId?: string, batchOrderId?: string, receiverWallet?: string) => void;
  couponDiscount: number;
  originalPrice?: number;
  productName: string;
  orderId: string;
  batchOrderId: string;
  fee: number;
  receiverWallet: string;
}) {
  const [selectedMethod, setSelectedMethod] = React.useState<PaymentMethod>('solana');
  const [paymentStatus, setPaymentStatus] = React.useState<PaymentStatus>('selecting');
  const [error, setError] = React.useState<string | null>(null);
  const [walletConnected, setWalletConnected] = React.useState(false);
  const [showWormholeWidget, setShowWormholeWidget] = React.useState(false);
  const [showJupiterWidget, setShowJupiterWidget] = React.useState(false);
  const { walletAddress, disconnect } = useWallet();
  const { processPayment } = usePayment();

  React.useEffect(() => {
    setWalletConnected(!!walletAddress);
  }, [walletAddress]);

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setError(null);
    setPaymentStatus('selecting');
    
    if (method === 'cross-chain') {
      setShowWormholeWidget(true);
      setShowJupiterWidget(false);
    } else if (method === 'other-tokens') {
      setShowJupiterWidget(true);
      setShowWormholeWidget(false);
    } else {
      setShowWormholeWidget(false);
      setShowJupiterWidget(false);
    }
  };

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
          setError('Please use the Jupiter widget below to complete your token swap');
          setPaymentStatus('selecting');
          break;
        case 'cross-chain':
          break;
        default:
          throw new Error('Invalid payment method selected');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
      setPaymentStatus('error');
    }
  };

  const processSolanaPayment = async () => {
    setPaymentStatus('confirming');
    
    let cartId = orderId ?? batchOrderId;
    const { success: paymentSuccess, signature: txSignature } = await processPayment(totalAmount, cartId, receiverWallet);
    
    if(!paymentSuccess || !txSignature) {
      setError('Payment failed or was cancelled');
      setPaymentStatus('error');
      onComplete(
        {
          success: false
        },
        txSignature || '',
        orderId,
        batchOrderId,
        receiverWallet
      );
      return;
    }
    
    setPaymentStatus('succeeded');
    onComplete(
      {
        success: true
      },
      txSignature, 
      orderId,
      batchOrderId,
      receiverWallet
    );
  };

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

  const isProcessing = paymentStatus === 'processing' || paymentStatus === 'confirming';

  // Jupiter Widget View
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
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Payment Methods
          </Button>
        </div>

        {paymentStatus === 'processing' && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <Loading type={LoadingType.ACTION} />
              </div>
              <div>
                <h4 className="text-blue-400 font-medium">Processing Token Swap</h4>
                <p className="text-sm text-gray-400 mt-1">Complete the swap in the widget below</p>
              </div>
            </div>
          </div>
        )}

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
          <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded-xl border border-red-500/30 backdrop-blur-sm">
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

  // Wormhole Widget View
  if (showWormholeWidget) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => {
              setShowWormholeWidget(false);
              setSelectedMethod('solana');
              setPaymentStatus('selecting');
              setError(null);
            }}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Payment Methods
          </Button>
        </div>

        {paymentStatus === 'processing' && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <Loading type={LoadingType.ACTION} />
              </div>
              <div>
                <h4 className="text-purple-400 font-medium">Processing Cross-Chain Transfer</h4>
                <p className="text-sm text-gray-400 mt-1">Complete the transfer in the widget below</p>
              </div>
            </div>
          </div>
        )}

        <WormholeWidget
          totalAmount={totalAmount}
          receiverWallet={receiverWallet}
          onComplete={onComplete}
          orderId={orderId}
          batchOrderId={batchOrderId}
          setPaymentStatus={setPaymentStatus}
          setError={setError}
        />

        {error && (
          <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded-xl border border-red-500/30 backdrop-blur-sm">
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

  // Main Payment Method Selection
  return (
    <div className="space-y-6">
      {/* Price Display */}
      <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-gray-300 text-sm font-medium">Total Amount</p>
              <p className="text-xs text-gray-400">Live pricing with real-time SOL rate</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white text-2xl font-bold">
              {(totalAmount).toFixed(4)} SOL 
            </p>
            {(couponDiscount ?? 0) > 0 && (originalPrice ?? 0) > 0 && (
              <div className="text-sm mt-1">
                <span className="text-gray-400 line-through">{((originalPrice ?? 0)).toFixed(4)} SOL</span>
                <span className="text-purple-400 ml-2">Coupon applied</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Method Selection */}
      <div className="space-y-4">
        <h3 className="text-white font-semibold text-lg">Select Payment Method</h3>
        
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
                <p className="text-sm text-gray-400 mt-1">Direct Solana payment • Instant • Lowest fees</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedMethod === 'solana' && (
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              <ArrowRight className={`h-5 w-5 transition-transform ${
                selectedMethod === 'solana' ? 'text-purple-400' : 'text-gray-400 group-hover:text-gray-300'
              }`} />
            </div>
          </div>
        </div>

        {/* Other Tokens with Jupiter */}
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
                <h4 className="text-white font-medium text-base">Pay with Other Tokens</h4>
                <p className="text-sm text-gray-400 mt-1">Swap any Solana token via Jupiter • Best rates</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedMethod === 'other-tokens' && (
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              <ArrowRight className={`h-5 w-5 transition-transform ${
                selectedMethod === 'other-tokens' ? 'text-blue-400' : 'text-gray-400 group-hover:text-gray-300'
              }`} />
            </div>
          </div>
        </div>

        {/* Cross-Chain Payment with Wormhole */}
        <div
          onClick={() => handlePaymentMethodSelect('cross-chain')}
          className={`group p-5 rounded-xl border cursor-pointer transition-all duration-200 ${
            selectedMethod === 'cross-chain'
              ? 'border-purple-500/50 bg-purple-500/10 shadow-lg shadow-purple-500/20'
              : 'border-gray-700/50 bg-gray-900/40 hover:border-gray-600/50 hover:bg-gray-900/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                🌉
              </div>
              <div>
                <h4 className="text-white font-medium text-base">Pay from Any Network</h4>
                <p className="text-sm text-gray-400 mt-1">Cross-chain payments via Wormhole • Multi-chain support</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {selectedMethod === 'cross-chain' && (
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              <ArrowRight className={`h-5 w-5 transition-transform ${
                selectedMethod === 'cross-chain' ? 'text-purple-400' : 'text-gray-400 group-hover:text-gray-300'
              }`} />
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Connection Status */}
      {!walletConnected && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Wallet className="h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <p className="text-yellow-400 font-medium text-sm">Wallet Required</p>
              <p className="text-yellow-300/80 text-xs mt-1">Please connect your wallet to continue with payment</p>
            </div>
          </div>
        </div>
      )}

      {walletConnected && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl backdrop-blur-sm">
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
              className="text-gray-400 hover:text-white transition-colors"
            >
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded-xl border border-red-500/30 backdrop-blur-sm">
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

      {/* Payment Button */}
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
        disabled={!walletConnected || isProcessing || ((selectedMethod === 'cross-chain' || selectedMethod === 'other-tokens') && paymentStatus === 'selecting')}
        className="w-full h-14 text-base font-semibold rounded-xl transition-all duration-200"
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
            <span className="text-gray-400 text-sm">Waiting for transaction confirmation...</span>
          </div>
          <p className="text-xs text-gray-500">
            Please approve the transaction in your wallet
          </p>
        </div>
      )}
    </div>
  );
}

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
      <div className="relative max-w-2xl w-full bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-gray-700/50 shadow-2xl my-8">
        <div className="p-6 border-b border-gray-700/50 flex justify-between items-center sticky top-0 bg-gray-900/95 backdrop-blur-xl z-10 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">Crypto Payment</h2>
            <p className="text-sm text-gray-400 mt-1">Secure payment with multiple options</p>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white p-2 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
          <ErrorBoundary fallback={
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
                <X className="h-8 w-8 text-red-400" />
              </div>
              <div>
                <p className="text-red-400 font-medium">Failed to load payment form</p>
                <p className="text-gray-400 text-sm mt-2">Please refresh the page and try again</p>
              </div>
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
                className="mt-4"
              >
                Refresh Page
              </Button>
            </div>
          }>
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