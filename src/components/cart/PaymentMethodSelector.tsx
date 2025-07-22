import React, { useState } from 'react';
import { ChevronDown, CreditCard, Wallet, Coins, Link, Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from 'react-toastify';

export interface PaymentMethod {
  type: 'stripe' | 'solana' | 'usdc' | 'other-tokens' | 'other-chains';
  tokenAddress?: string;
  chainId?: string;
  tokenSymbol?: string;
  chainName?: string;
}

export interface PriceQuote {
  tokenAmount: string;
  tokenSymbol: string;
  usdValue: string;
  exchangeRate: string;
  loading: boolean;
  error?: string;
}

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onMethodChange: (method: PaymentMethod) => void;
  isConnected: boolean;
  disabled?: boolean;
  usdAmount: number; // The USD amount to convert
  onGetPriceQuote?: (tokenAddress: string, chainId?: string) => Promise<PriceQuote>;
}

const POPULAR_TOKENS = [
  { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', name: 'USD Coin' },
  { symbol: 'USDT', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', name: 'Tether USD' },
  { symbol: 'BONK', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', name: 'Bonk' },
  { symbol: 'WIF', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', name: 'Dogwifhat' },
];

const SUPPORTED_CHAINS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
  { id: 'bsc', name: 'Binance Smart Chain', symbol: 'BNB' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH' },
  { id: 'optimism', name: 'Optimism', symbol: 'ETH' },
  { id: 'base', name: 'Base', symbol: 'ETH' },
];

export function PaymentMethodSelector({ 
  selectedMethod, 
  onMethodChange, 
  isConnected, 
  disabled, 
  usdAmount, 
  onGetPriceQuote 
}: PaymentMethodSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [customTokenSymbol, setCustomTokenSymbol] = useState('');
  const [selectedChain, setSelectedChain] = useState(SUPPORTED_CHAINS[0]);
  const [customChainTokenAddress, setCustomChainTokenAddress] = useState('');
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);

  const paymentOptions = [
    {
      type: 'stripe' as const,
      label: 'Credit Card',
      description: 'Pay with Visa, Mastercard, etc.',
      icon: CreditCard,
      available: true
    },
    {
      type: 'usdc' as const,
      label: 'Pay with USDC',
      description: 'Direct USDC payment',
      icon: Wallet,
      available: isConnected
    },
    {
      type: 'solana' as const,
      label: 'Pay with SOL',
      description: 'Direct SOL payment',
      icon: Wallet,
      available: isConnected
    },
    {
      type: 'other-tokens' as const,
      label: 'Use Other Tokens',
      description: 'Pay with any SPL token',
      icon: Coins,
      available: isConnected
    },
    {
      type: 'other-chains' as const,
      label: 'Pay from Other Chains',
      description: 'Cross-chain payments',
      icon: Link,
      available: true
    }
  ];
  // Dummy price quote function - you can replace this with your implementation
  const getDummyPriceQuote = async (tokenAddress: string, chainId?: string): Promise<PriceQuote> => {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Dummy data - replace with actual API call
    const mockRates: { [key: string]: number } = {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1.00, // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.00, // USDT
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 0.000025, // BONK
      'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 2.45, // WIF
    };
    
    const rate = mockRates[tokenAddress] || Math.random() * 100; // Random rate for unknown tokens
    const tokenAmount = (usdAmount / rate).toFixed(6);
    
    return {
      tokenAmount,
      tokenSymbol: customTokenSymbol || 'TOKEN',
      usdValue: usdAmount.toFixed(2),
      exchangeRate: rate.toFixed(6),
      loading: false
    };
  };

  // Function to get price quote
  const fetchPriceQuote = async (tokenAddress: string, chainId?: string) => {
    if (!tokenAddress.trim()) return;
    
    setPriceQuote({ 
      tokenAmount: '0', 
      tokenSymbol: customTokenSymbol || 'TOKEN', 
      usdValue: '0', 
      exchangeRate: '0', 
      loading: true 
    });
    
    try {
      const quote = onGetPriceQuote 
        ? await onGetPriceQuote(tokenAddress, chainId)
        : await getDummyPriceQuote(tokenAddress, chainId);
      
      setPriceQuote(quote);
    } catch (error) {
      setPriceQuote({
        tokenAmount: '0',
        tokenSymbol: customTokenSymbol || 'TOKEN',
        usdValue: '0',
        exchangeRate: '0',
        loading: false,
        error: 'Failed to get price quote'
      });
    }
  };

  const handleMethodSelect = (method: typeof paymentOptions[0]) => {
    if (!method.available) return;
    
    setIsDropdownOpen(false);
    
    const paymentMethod: PaymentMethod = { type: method.type };
    
    if (method.type === 'usdc') {
      paymentMethod.tokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      paymentMethod.tokenSymbol = 'USDC';
    }
    
    onMethodChange(paymentMethod);
  };

  const handleCustomTokenSubmit = () => {
    if (!customTokenAddress.trim()) {
      toast.error('Please enter a token address');
      return;
    }

    onMethodChange({
      type: 'other-tokens',
      tokenAddress: customTokenAddress,
      tokenSymbol: customTokenSymbol || 'TOKEN'
    });

    toast.success(`Token ${customTokenSymbol || 'TOKEN'} selected for payment`);
    
    // Fetch price quote when token is selected
    fetchPriceQuote(customTokenAddress);
  };

  const handlePopularTokenSelect = (token: typeof POPULAR_TOKENS[0]) => {
    setCustomTokenAddress(token.address);
    setCustomTokenSymbol(token.symbol);
    
    onMethodChange({
      type: 'other-tokens',
      tokenAddress: token.address,
      tokenSymbol: token.symbol
    });

    toast.success(`${token.symbol} selected for payment`);
    
    // Fetch price quote for popular token
    fetchPriceQuote(token.address);
  };

  const handleChainPaymentSubmit = () => {
    if (!customChainTokenAddress.trim()) {
      toast.error('Please enter a token address');
      return;
    }

    onMethodChange({
      type: 'other-chains',
      tokenAddress: customChainTokenAddress,
      chainId: selectedChain.id,
      chainName: selectedChain.name,
      tokenSymbol: 'TOKEN'
    });

    toast.success(`Cross-chain payment configured for ${selectedChain.name}`);
    
    // Fetch price quote for cross-chain token
    fetchPriceQuote(customChainTokenAddress, selectedChain.id);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const getSelectedMethodLabel = () => {
    if (!selectedMethod) return 'Select Payment Method';
    
    switch (selectedMethod.type) {
      case 'stripe':
        return 'Credit Card';
      case 'usdc':
        return 'USDC Payment';
      case 'solana':
        return 'SOL Payment';
      case 'other-tokens':
        return `${selectedMethod.tokenSymbol || 'Token'} Payment`;
      case 'other-chains':
        return `${selectedMethod.chainName} Payment`;
      default:
        return 'Select Payment Method';
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <label className="block text-sm font-medium text-gray-200 mb-2">
          Payment Method
        </label>
        
        {/* Dropdown Trigger */}
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={disabled}
          className="w-full flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg text-left hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className="text-white">{getSelectedMethodLabel()}</span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedMethod?.type === option.type;
              
              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => handleMethodSelect(option)}
                  disabled={!option.available}
                  className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    isSelected ? 'bg-gray-700' : ''
                  }`}
                >
                  <Icon className={`h-5 w-5 ${option.available ? 'text-secondary' : 'text-gray-500'}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${option.available ? 'text-white' : 'text-gray-500'}`}>
                        {option.label}
                      </span>
                      {isSelected && <Check className="h-4 w-4 text-secondary" />}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
                    {!option.available && option.type !== 'stripe' && (
                      <p className="text-xs text-yellow-400 mt-0.5">Wallet connection required</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Token Input */}
      {selectedMethod?.type === 'other-tokens' && (
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-white">Select SPL Token</h4>
          
          {/* Popular Tokens */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Popular Tokens</label>
            <div className="grid grid-cols-2 gap-2">
              {POPULAR_TOKENS.map((token) => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => handlePopularTokenSelect(token)}
                  className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${
                    selectedMethod.tokenAddress === token.address
                      ? 'border-secondary bg-secondary/10'
                      : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{token.symbol[0]}</span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">{token.symbol}</div>
                    <div className="text-xs text-gray-400">{token.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Token */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Or Enter Custom Token</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Token contract address"
                  value={customTokenAddress}
                  onChange={(e) => setCustomTokenAddress(e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                />
                <input
                  type="text"
                  placeholder="Symbol"
                  value={customTokenSymbol}
                  onChange={(e) => setCustomTokenSymbol(e.target.value)}
                  className="w-20 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>
              <Button
                type="button"
                onClick={handleCustomTokenSubmit}
                variant="outline"
                size="sm"
                disabled={!customTokenAddress.trim()}
                className="w-full"
              >
                Use This Token
              </Button>
              
              {/* Get Price Quote Button */}
              <Button
                type="button"
                onClick={() => fetchPriceQuote(customTokenAddress)}
                variant="ghost"
                size="sm"
                disabled={!customTokenAddress.trim() || priceQuote?.loading}
                className="w-full"
              >
                {priceQuote?.loading ? 'Getting Quote...' : 'Get Price Quote'}
              </Button>
            </div>
          </div>
          
          {/* Price Quote Display */}
          {priceQuote && customTokenAddress && (
            <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
              <h5 className="text-xs font-medium text-gray-300">Price Quote</h5>
              
              {priceQuote.loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary"></div>
                  <span className="text-sm text-gray-400">Fetching price...</span>
                </div>
              ) : priceQuote.error ? (
                <div className="text-sm text-red-400">{priceQuote.error}</div>
              ) : (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">You'll pay:</span>
                    <span className="text-sm font-medium text-white">
                      {priceQuote.tokenAmount} {priceQuote.tokenSymbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">USD Value:</span>
                    <span className="text-sm text-gray-300">${priceQuote.usdValue}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Exchange Rate:</span>
                    <span className="text-xs text-gray-400">
                      1 {priceQuote.tokenSymbol} = ${priceQuote.exchangeRate}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cross-Chain Payment */}
      {selectedMethod?.type === 'other-chains' && (
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-white">Cross-Chain Payment</h4>
          
          {/* Chain Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Select Chain</label>
            <select
              value={selectedChain.id}
              onChange={(e) => {
                const chain = SUPPORTED_CHAINS.find(c => c.id === e.target.value);
                if (chain) setSelectedChain(chain);
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              {SUPPORTED_CHAINS.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name} ({chain.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Token Address Input */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">
              Token Contract Address
            </label>
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="0x... or paste token address"
                  value={customChainTokenAddress}
                  onChange={(e) => setCustomChainTokenAddress(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                />
                {customChainTokenAddress && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(customChainTokenAddress)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-600 rounded"
                  >
                    <Copy className="h-3 w-3 text-gray-400" />
                  </button>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleChainPaymentSubmit}
                  variant="outline"
                  size="sm"
                  disabled={!customChainTokenAddress.trim()}
                  className="flex-1"
                >
                  Configure Payment
                </Button>
                
                <Button
                  type="button"
                  onClick={() => fetchPriceQuote(customChainTokenAddress, selectedChain.id)}
                  variant="ghost"
                  size="sm"
                  disabled={!customChainTokenAddress.trim() || priceQuote?.loading}
                  className="flex-1"
                >
                  {priceQuote?.loading ? 'Getting Quote...' : 'Get Quote'}
                </Button>
                
                <Button
                  type="button"
                  onClick={() => window.open(`https://${selectedChain.id === 'ethereum' ? 'etherscan.io' : 'polygonscan.com'}/`, '_blank')}
                  variant="ghost"
                  size="sm"
                  className="px-3"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Price Quote Display for Cross-Chain */}
          {priceQuote && customChainTokenAddress && selectedMethod?.type === 'other-chains' && (
            <div className="bg-gray-700/50 rounded-lg p-3 space-y-2">
              <h5 className="text-xs font-medium text-gray-300">
                Price Quote ({selectedChain.name})
              </h5>
              
              {priceQuote.loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary"></div>
                  <span className="text-sm text-gray-400">Fetching price...</span>
                </div>
              ) : priceQuote.error ? (
                <div className="text-sm text-red-400">{priceQuote.error}</div>
              ) : (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">You'll pay:</span>
                    <span className="text-sm font-medium text-white">
                      {priceQuote.tokenAmount} TOKEN
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">USD Value:</span>
                    <span className="text-sm text-gray-300">${priceQuote.usdValue}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Network:</span>
                    <span className="text-xs text-gray-400">{selectedChain.name}</span>
                  </div>
                  <div className="text-xs text-blue-400 mt-2">
                    Cross-chain bridge fee may apply
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
            <p className="text-xs text-blue-400">
              Cross-chain payments are powered by our bridge technology. Transactions may take 5-15 minutes to complete.
            </p>
          </div>
        </div>
      )}

      {/* Connection Warning */}
      {selectedMethod && ['usdc', 'solana', 'other-tokens'].includes(selectedMethod.type) && !isConnected && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
          <p className="text-xs text-yellow-400">
            Please connect your wallet to continue with this payment method.
          </p>
        </div>
      )}
    </div>
  );
}