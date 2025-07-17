import React from 'react';
import { X, Wallet, ArrowRight, Check, ExternalLink } from 'lucide-react';
import { useSolanaPrice } from '../../utils/price-conversion';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { useWallet } from '../../contexts/WalletContext';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Button } from '../ui/Button';
import { usePayment } from '../../hooks/usePayment';

// Type definitions
interface ShippingAddress {
  address: string;
  city: string;
  country: string;
  zip: string;
}

interface ContactInfo {
  method: string;
  value: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

// interface ShippingInfo {
//   shipping_address: ShippingAddress;
//   contact_info: ContactInfo;
// }

interface CryptoPaymentModalProps {
  onClose: () => void;
  onSuccess: (txSignature: string, batchOrderId?: string) => void;
  totalAmount: number;
  productName: string;
  batchOrderId: string;
  couponCode?: string;
  couponDiscount?: number;
  originalPrice?: number;
  walletAmounts?: Array<{ [address: string]: number }>;
  fee?: number; // Optional fee for the transaction
}

type PaymentMethod = 'solana' | 'other-tokens' | 'other-networks';
type PaymentStatus = 'selecting' | 'processing' | 'confirming' | 'succeeded' | 'error';

// Supported tokens and networks
const SUPPORTED_TOKENS = [
  { symbol: 'SOL', name: 'Solana', icon: '◎', primary: true },
  { symbol: 'USDC', name: 'USD Coin', icon: '💰', primary: false },
  { symbol: 'USDT', name: 'Tether', icon: '₮', primary: false },
  { symbol: 'BONK', name: 'Bonk', icon: '🐶', primary: false },
  { symbol: 'JUP', name: 'Jupiter', icon: '🪐', primary: false },
];

const SUPPORTED_NETWORKS = [
  { name: 'Ethereum', symbol: 'ETH', icon: '⟠', color: 'text-blue-400' },
  { name: 'Polygon', symbol: 'MATIC', icon: '⬟', color: 'text-purple-400' },
  { name: 'Arbitrum', symbol: 'ARB', icon: '🔷', color: 'text-blue-300' },
  { name: 'Optimism', symbol: 'OP', icon: '🔴', color: 'text-red-400' },
  { name: 'Base', symbol: 'BASE', icon: '🔵', color: 'text-blue-500' },
];

function CryptoPaymentForm({
  totalAmount,
  onSuccess,
  couponDiscount,
  originalPrice,
  walletAmounts,
  productName,
  batchOrderId,
  fee,
}: {
  totalAmount: number;
  onSuccess: (txSignature: string, batchOrderId?: string) => void;
  couponDiscount: number;
  originalPrice?: number;
  walletAmounts?: Array<{ [address: string]: number }>;
  productName: string;
  batchOrderId: string;
  fee: number
}) {
  const [selectedMethod, setSelectedMethod] = React.useState<PaymentMethod>('solana');
  const [selectedToken, setSelectedToken] = React.useState(SUPPORTED_TOKENS[0]);
  const [selectedNetwork, setSelectedNetwork] = React.useState(SUPPORTED_NETWORKS[0]);
  const [paymentStatus, setPaymentStatus] = React.useState<PaymentStatus>('selecting');
  const [error, setError] = React.useState<string | null>(null);
  const [walletConnected, setWalletConnected] = React.useState(false);
  const { walletAddress, disconnect } = useWallet();
  const { processPayment } = usePayment();

  // Check wallet connection status
  React.useEffect(() => {
    setWalletConnected(!!walletAddress);
  }, [walletAddress]);

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setError(null);
  };

  const handleTokenSelect = (token: typeof SUPPORTED_TOKENS[0]) => {
    setSelectedToken(token);
  };

  const handleNetworkSelect = (network: typeof SUPPORTED_NETWORKS[0]) => {
    setSelectedNetwork(network);
  };

  const handlePayment = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    setPaymentStatus('processing');
    setError(null);

    try {
      // in case of discount being 100%, should never get here tho, as it's handled outside.
      // setPaymentStatus('succeeded');

      // Here you would implement the actual payment logic based on selected method
      switch (selectedMethod) {
        case 'solana':
          await processSolanaPayment();
          break;
        case 'other-tokens':
          await processTokenPayment();
          break;
        case 'other-networks':
          await processNetworkPayment();
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

    // the fee here is a little gas fee to execute the transaction to all required merchants
    const totalAmountWithGasFee = totalAmount + fee - couponDiscount;
    
    const { success: paymentSuccess, signature: txSignature } = await processPayment(totalAmountWithGasFee, batchOrderId, walletAmounts);
    
    if(!paymentSuccess || !txSignature) {
      setError('Payment failed or was cancelled');
      setPaymentStatus('error');
      return;
    }
    
    setPaymentStatus('succeeded');
    onSuccess(txSignature, "batchOrderId");
  };

  const processTokenPayment = async () => {
    setPaymentStatus('confirming');
    
    // Simulate token payment processing
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Mock successful transaction
    const mockTxSignature = `mock_${selectedToken.symbol.toLowerCase()}_tx_` + Date.now();
    setPaymentStatus('succeeded');
    onSuccess(mockTxSignature, undefined);
  };

  const processNetworkPayment = async () => {
    setPaymentStatus('confirming');
    
    // Simulate cross-chain payment processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Mock successful transaction
    const mockTxSignature = `mock_${selectedNetwork.symbol.toLowerCase()}_tx_` + Date.now();
    setPaymentStatus('succeeded');
    onSuccess(mockTxSignature, undefined);
  };

  if (totalAmount === 0) {
    return <Loading type={LoadingType.ACTION} text="Loading price data..." />;
  }

  const isProcessing = paymentStatus === 'processing' || paymentStatus === 'confirming';

  return (
    <div className="space-y-6">
      {/* Price Display */}
      <div className="bg-gray-800/50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-300">Amount:</span>
          <div className="text-right">
            <span className="text-white font-medium">
              {(totalAmount + fee - couponDiscount).toFixed(2)} SOL 
              {/* <span className="text-gray-400">(${usdAmount})</span> */}
            </span>
            {(couponDiscount ?? 0) > 0 && (originalPrice ?? 0) > 0 && (
              <div className="text-sm">
                <span className="text-gray-400 line-through">{((originalPrice ?? 0)).toFixed(2)} SOL</span>
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
                <div className="text-white font-medium">Pay with Solana</div>
                <div className="text-sm text-gray-400">Direct SOL payment</div>
              </div>
            </div>
            {selectedMethod === 'solana' && (
              <Check className="h-5 w-5 text-primary-400" />
            )}
          </div>
        </div>

        {/* Other Tokens */}
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
                💰
              </div>
              <div>
                <div className="text-white font-medium">Pay with Other Tokens</div>
                <div className="text-sm text-gray-400">USDC, USDT, and more</div>
              </div>
            </div>
            {selectedMethod === 'other-tokens' && (
              <Check className="h-5 w-5 text-primary-400" />
            )}
          </div>
        </div>

        {/* Other Networks */}
        <div
          onClick={() => handlePaymentMethodSelect('other-networks')}
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            selectedMethod === 'other-networks'
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
                <div className="text-white font-medium">Pay with Other Networks</div>
                <div className="text-sm text-gray-400">Ethereum, Polygon, and more</div>
              </div>
            </div>
            {selectedMethod === 'other-networks' && (
              <Check className="h-5 w-5 text-primary-400" />
            )}
          </div>
        </div>
      </div>

      {/* Token Selection (when other-tokens is selected) */}
      {selectedMethod === 'other-tokens' && (
        <div className="space-y-3">
          <h4 className="text-white font-medium text-sm">Select Token</h4>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_TOKENS.map((token) => (
              <button
                key={token.symbol}
                onClick={() => handleTokenSelect(token)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedToken.symbol === token.symbol
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{token.icon}</span>
                  <div>
                    <div className="text-white text-sm font-medium">{token.symbol}</div>
                    <div className="text-xs text-gray-400">{token.name}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Network Selection (when other-networks is selected) */}
      {selectedMethod === 'other-networks' && (
        <div className="space-y-3">
          <h4 className="text-white font-medium text-sm">Select Network</h4>
          <div className="space-y-2">
            {SUPPORTED_NETWORKS.map((network) => (
              <button
                key={network.name}
                onClick={() => handleNetworkSelect(network)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  selectedNetwork.name === network.name
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-lg ${network.color}`}>{network.icon}</span>
                    <div>
                      <div className="text-white text-sm font-medium">{network.name}</div>
                      <div className="text-xs text-gray-400">{network.symbol}</div>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Wallet Connection */}
      {/* {!walletConnected && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <Wallet className="h-5 w-5 text-yellow-400" />
            <span className="text-yellow-400 font-medium">Wallet Required</span>
          </div>
          <p className="text-sm text-gray-300 mb-4">
            Connect your wallet to continue with crypto payment
          </p>
          <Button
            onClick={handleConnectWallet}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            Connect Wallet
          </Button>
        </div>
      )} */}
      {!walletConnected && (
        <p className="mt-2 text-xs text-yellow-400">
            Please connect your wallet to continue with Solana payment
        </p>
        )}

      {/* Connected Wallet Info */}
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
        <div className="text-red-500 text-sm p-4 bg-red-500/10 rounded-lg">
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
        disabled={!walletConnected || isProcessing || paymentStatus === 'selecting'}
        className="w-full"
      >
        {!walletConnected ? (
          'Connect Wallet to Continue'
        ) : isProcessing ? (
          'Processing Payment...'
        ) : (
          <>
            Continue to Payment
            <ArrowRight className="h-4 w-4 ml-2" />
          </>
        )}
      </Button>

      {/* Payment Status */}
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
  onSuccess,
  totalAmount,
  productName,
  batchOrderId,
  walletAmounts = [],
  couponDiscount = 0,
  originalPrice = 0,
  fee = 0
}: CryptoPaymentModalProps) {

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/80 backdrop-blur-lg overflow-y-auto">
      <div className="relative max-w-lg w-full bg-gray-900 rounded-xl p-6 my-8">
        <div className="p-4 sm:p-6 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900 z-10">
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
              onSuccess={onSuccess}
              couponDiscount={couponDiscount}
              originalPrice={originalPrice}
              productName={productName}
              batchOrderId={batchOrderId}
              walletAmounts={walletAmounts}
              fee={fee}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}