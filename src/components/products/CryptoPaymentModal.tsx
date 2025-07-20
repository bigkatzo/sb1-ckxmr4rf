import React from 'react';
import { X, ArrowRight, Check } from 'lucide-react';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { useWallet } from '../../contexts/WalletContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Button } from '../ui/Button';
import { usePayment } from '../../hooks/usePayment';
import { LiFiWidget, WidgetConfig, useWidgetEvents, WidgetEvent, ChainType } from '@lifi/widget';
import '../../styles/lifi-widget.css';

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
  const jupiterRef = React.useRef<HTMLDivElement>(null);
  const [isJupiterLoaded, setIsJupiterLoaded] = React.useState(false);
  const [isJupiterInitialized, setIsJupiterInitialized] = React.useState(false);
  const { walletAddress } = useWallet();

  // Load Jupiter script
  React.useEffect(() => {
    let script: HTMLScriptElement | null = null;
    
    const loadJupiter = () => {
      // Check if script already exists
      const existingScript = document.querySelector('script[src*="terminal.jup.ag"]');
      if (existingScript) {
        if (window.Jupiter) {
          setIsJupiterLoaded(true);
        }
        return;
      }

      script = document.createElement('script');
      script.src = 'https://terminal.jup.ag/main-v2.js';
      script.async = true;
      script.onload = () => {
        console.log('Jupiter script loaded');
        setIsJupiterLoaded(true);
      };
      script.onerror = () => {
        console.error('Failed to load Jupiter script');
        setError('Failed to load Jupiter widget. Please try again.');
      };
      document.head.appendChild(script);
    };

    loadJupiter();

    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [setError]);

  // Initialize Jupiter when script is loaded
  React.useEffect(() => {
    if (!isJupiterLoaded || !window.Jupiter || !walletAddress || isJupiterInitialized) {
      return;
    }

    const initializeJupiter = () => {
      try {
        console.log('Initializing Jupiter with config:', {
          totalAmount,
          walletAddress,
          receiverWallet
        });

        window.Jupiter!.init({
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
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initializeJupiter, 500);
    return () => clearTimeout(timer);
  }, [isJupiterLoaded, walletAddress, totalAmount, receiverWallet, onComplete, orderId, batchOrderId, setPaymentStatus, setError, isJupiterInitialized]);

  if (!isJupiterLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading type={LoadingType.ACTION} text="Loading Jupiter widget..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800/50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-300">Target amount:</span>
          <div className="text-right">
            <span className="text-white font-medium">
              {totalAmount.toFixed(4)} SOL
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          Swap any token on Solana to SOL using Jupiter's best routes
        </div>
      </div>
      
      <div 
        ref={jupiterRef}
        id="jupiter-terminal"
        className="bg-gray-900 rounded-lg overflow-hidden min-h-[600px] border border-gray-700"
        style={{
          width: '100%',
          minHeight: '600px'
        }}
      />

      {!isJupiterInitialized && isJupiterLoaded && (
        <div className="flex items-center justify-center p-8">
          <Loading type={LoadingType.ACTION} text="Initializing Jupiter..." />
        </div>
      )}
    </div>
  );
}

// Widget Events Component
function WidgetEventsHandler({
  onComplete,
  orderId,
  batchOrderId,
  receiverWallet,
  setPaymentStatus,
  setError,
}: {
  onComplete: (status: any, txSignature: string, orderId?: string, batchOrderId?: string, receiverWallet?: string) => void;
  orderId?: string;
  batchOrderId?: string;
  receiverWallet: string;
  setPaymentStatus: (status: PaymentStatus) => void;
  setError: (error: string | null) => void;
}) {
  const widgetEvents = useWidgetEvents();

  React.useEffect(() => {
    const onRouteExecutionStarted = (route: any) => {
      console.log('Li.Fi: Route execution started', route);
      setPaymentStatus('processing');
    };

    const onRouteExecutionCompleted = (route: any) => {
      console.log('Li.Fi: Route execution completed', route);
      setPaymentStatus('succeeded');
      
      const txHash = route?.steps?.[route.steps.length - 1]?.execution?.txHash || 
                    route?.transactionHash || 
                    `lifi_${Date.now()}`;
      
      onComplete(
        {
          success: true,
          crossChain: true,
          route: route
        },
        txHash,
        orderId,
        batchOrderId,
        receiverWallet
      );
    };

    const onRouteExecutionFailed = (update: any) => {
      const { route, error } = update;
      console.error('Li.Fi: Route execution failed', { route, error });
      setError(error?.message || 'Cross-chain payment failed');
      setPaymentStatus('error');
    };

    const onRouteHighValueLoss = (route: any) => {
      console.warn('Li.Fi: High value loss detected', route);
    };

    const onRouteExecutionUpdated = (routeExecutionUpdate: any) => {
      console.log('Li.Fi: Route execution updated', routeExecutionUpdate);
    };

    widgetEvents.on(WidgetEvent.RouteExecutionStarted, onRouteExecutionStarted);
    widgetEvents.on(WidgetEvent.RouteExecutionCompleted, onRouteExecutionCompleted);
    widgetEvents.on(WidgetEvent.RouteExecutionFailed, onRouteExecutionFailed);
    widgetEvents.on(WidgetEvent.RouteHighValueLoss, onRouteHighValueLoss);
    widgetEvents.on(WidgetEvent.RouteExecutionUpdated, onRouteExecutionUpdated);

    return () => {
      widgetEvents.off(WidgetEvent.RouteExecutionStarted, onRouteExecutionStarted);
      widgetEvents.off(WidgetEvent.RouteExecutionCompleted, onRouteExecutionCompleted);
      widgetEvents.off(WidgetEvent.RouteExecutionFailed, onRouteExecutionFailed);
      widgetEvents.off(WidgetEvent.RouteHighValueLoss, onRouteHighValueLoss);
      widgetEvents.off(WidgetEvent.RouteExecutionUpdated, onRouteExecutionUpdated);
    };
  }, [widgetEvents, onComplete, orderId, batchOrderId, receiverWallet, setPaymentStatus, setError]);

  return null;
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
  const [showLiFiWidget, setShowLiFiWidget] = React.useState(false);
  const [showJupiterWidget, setShowJupiterWidget] = React.useState(false);
  const { walletAddress, disconnect } = useWallet();
  const { processPayment } = usePayment();

  React.useEffect(() => {
    setWalletConnected(!!walletAddress);
  }, [walletAddress]);

  const toLifiAddress = {
    name: "Store.fun",
    address: receiverWallet,
    chainType: ChainType.SVM,
  };

  const lifiConfig: WidgetConfig = React.useMemo(() => ({
    integrator: 'store.fun', // Replace with your app name
    theme: {
      palette: {
        primary: { main: '#8B5CF6' },
        secondary: { main: '#6B7280' },
        background: {
          default: '#111827',
          paper: '#1F2937',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#9CA3AF',
        },
      },
      shape: {
        borderRadius: 12,
      },
      components: {
        MuiCard: {
          styleOverrides: {
            root: {
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
            },
          },
        },
      },
    },
    appearance: 'dark',
    hiddenUI: ['language', 'appearance'],
    toChain: 101, // Solana chain ID
    toToken: 'SOL',
    toAmount: totalAmount.toString(),
    toAddress: toLifiAddress,
    disabledUI: ['toToken', 'toAddress'],
    variant: 'compact',
    subvariant: 'default',
    walletManagement: {
      connect: true,
      disconnect: true,
    }
  }), [totalAmount, receiverWallet]);

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setError(null);
    setPaymentStatus('selecting');
    
    if (method === 'cross-chain') {
      setShowLiFiWidget(true);
      setShowJupiterWidget(false);
    } else if (method === 'other-tokens') {
      setShowJupiterWidget(true);
      setShowLiFiWidget(false);
    } else {
      setShowLiFiWidget(false);
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
    return <Loading type={LoadingType.ACTION} text="Loading price data..." />;
  }

  const isProcessing = paymentStatus === 'processing' || paymentStatus === 'confirming';

  // Jupiter Widget View
  if (showJupiterWidget) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
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

        {paymentStatus === 'processing' && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Loading type={LoadingType.ACTION} />
              <div>
                <div className="text-blue-400 font-medium">Processing Token Swap</div>
                <div className="text-sm text-gray-400">Complete the swap in the widget below</div>
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
          <div className="text-red-500 text-sm p-4 bg-red-500/10 rounded-lg border border-red-500/20">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Li.Fi Widget View
  if (showLiFiWidget) {
    return (
      <div className="space-y-6">
        <WidgetEventsHandler
          onComplete={onComplete}
          orderId={orderId}
          batchOrderId={batchOrderId}
          receiverWallet={receiverWallet}
          setPaymentStatus={setPaymentStatus}
          setError={setError}
        />

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setShowLiFiWidget(false);
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

        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-300">Target amount:</span>
            <div className="text-right">
              <span className="text-white font-medium">
                {totalAmount.toFixed(4)} SOL
              </span>
              {(couponDiscount ?? 0) > 0 && (originalPrice ?? 0) > 0 && (
                <div className="text-sm">
                  <span className="text-gray-400 line-through">{((originalPrice ?? 0)).toFixed(4)} SOL</span>
                  <span className="text-primary-400 ml-2">Coupon applied</span>
                </div>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-400">
            Destination: {receiverWallet}
          </div>
        </div>

        {paymentStatus === 'processing' && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Loading type={LoadingType.ACTION} />
              <div>
                <div className="text-blue-400 font-medium">Processing Cross-Chain Payment</div>
                <div className="text-sm text-gray-400">Complete the transaction in the widget below</div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Li.Fi Widget Container */}
        <div className="bg-gray-800/30 rounded-lg border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <div className="text-sm text-gray-300 font-medium">Cross-Chain Payment</div>
            <div className="text-xs text-gray-400 mt-1">
              Pay with any token from any supported network
            </div>
          </div>
          
          <div className="lifi-widget-container p-4">
            <LiFiWidget
              config={lifiConfig}
              integrator="store.fun"
            />
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm p-4 bg-red-500/10 rounded-lg border border-red-500/20">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Main Payment Method Selection
  return (
    <div className="space-y-6">
      {/* Price Display */}
      <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-300">Total Amount:</span>
          <div className="text-right">
            <span className="text-white font-medium text-lg">
              {(totalAmount).toFixed(4)} SOL 
            </span>
            {(couponDiscount ?? 0) > 0 && (originalPrice ?? 0) > 0 && (
              <div className="text-sm">
                <span className="text-gray-400 line-through">{((originalPrice ?? 0)).toFixed(4)} SOL</span>
                <span className="text-primary-400 ml-2">Coupon applied</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-400">
          Price updated in real-time based on current SOL rate
        </div>
      </div>

      {/* Payment Method Selection */}
      <div className="space-y-4">
        <h3 className="text-white font-medium">Select Payment Method</h3>
        
        {/* Solana Payment */}
        <div
          onClick={() => handlePaymentMethodSelect('solana')}
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            selectedMethod === 'solana'
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                ◎
              </div>
              <div>
                <div className="text-white font-medium">Pay with SOL</div>
                <div className="text-sm text-gray-400">Direct Solana payment</div>
              </div>
            </div>
            {selectedMethod === 'solana' && (
              <Check className="h-5 w-5 text-primary-400" />
            )}
          </div>
        </div>

        {/* Other Tokens with Jupiter */}
        <div
          onClick={() => handlePaymentMethodSelect('other-tokens')}
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            selectedMethod === 'other-tokens'
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                🪐
              </div>
              <div>
                <div className="text-white font-medium">Pay with Other Tokens</div>
                <div className="text-sm text-gray-400">Swap any Solana token via Jupiter</div>
              </div>
            </div>
            {selectedMethod === 'other-tokens' && (
              <Check className="h-5 w-5 text-primary-400" />
            )}
          </div>
        </div>

        {/* Cross-Chain Payment with Li.Fi */}
        <div
          onClick={() => handlePaymentMethodSelect('cross-chain')}
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            selectedMethod === 'cross-chain'
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                🔗
              </div>
              <div>
                <div className="text-white font-medium">Pay from Any Network</div>
                <div className="text-sm text-gray-400">Cross-chain payments via Li.Fi</div>
              </div>
            </div>
            {selectedMethod === 'cross-chain' && (
              <Check className="h-5 w-5 text-primary-400" />
            )}
          </div>
        </div>
      </div>

      {/* Wallet Connection Status */}
      {!walletConnected && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 text-sm">
            Please connect your wallet to continue with payment
          </p>
        </div>
      )}

      {walletConnected && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-green-400 font-medium text-sm">Wallet Connected</div>
                <div className="text-xs text-gray-400">
                  {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                </div>
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

      {/* Error Display */}
      {error && (
        <div className="text-red-500 text-sm p-4 bg-red-500/10 rounded-lg border border-red-500/20">
          {error}
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
        className="w-full"
      >
        {!walletConnected ? (
          'Connect Wallet to Continue'
        ) : selectedMethod === 'cross-chain' ? (
          'Open Cross-Chain Payment'
        ) : selectedMethod === 'other-tokens' ? (
          'Open Token Swap'
        ) : isProcessing ? (
          'Processing Payment...'
        ) : (
          <>
            Continue to Payment
            <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>

      {paymentStatus === 'confirming' && (
        <div className="text-sm text-gray-400 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Loading type={LoadingType.ACTION} />
            <span>Waiting for transaction confirmation...</span>
          </div>
          <p className="text-xs">
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
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/80 backdrop-blur-lg overflow-y-auto">
      <div className="relative max-w-lg w-full bg-gray-900 rounded-xl border border-gray-800 my-8">
        <div className="p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900 z-10 rounded-t-xl">
          <h2 className="text-lg font-semibold text-white">Crypto Payment</h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white p-2 rounded-lg"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
          <ErrorBoundary fallback={
            <div className="p-4 text-red-500 text-center">
              <p>Failed to load payment form.</p>
              <Button
                onClick={() => window.location.reload()}
                variant="link"
                className="mt-4 text-sm font-medium"
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