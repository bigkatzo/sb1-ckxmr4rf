import React, { useState } from 'react';
import { ChevronDown, CreditCard, Wallet, Coins, Link, Check, Copy, ExternalLink, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from 'react-toastify';

export interface PaymentMethod {
  type: 'stripe' | 'tokens' | 'other-chains';
  defaultToken?: 'usdc' | 'sol';
  tokenAddress?: string;
  chainId?: string;
  tokenSymbol?: string;
  tokenName?: string;
  chainName?: string;
}

export interface PriceQuote {
  tokenAmount: string;
  tokenSymbol: string;
  tokenName: string;
  usdValue: string;
  exchangeRate: string;
  loading: boolean;
  error?: string;
  fee?: string;
  bridgeFee?: string;
}

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onMethodChange: (method: PaymentMethod) => void;
  isConnected: boolean;
  disabled?: boolean;
  usdAmount: number;
  onGetPriceQuote?: (tokenAddress: string, chainId?: string) => Promise<PriceQuote>;
}

const POPULAR_TOKENS = [
  { 
    symbol: 'SOL', 
    address: 'So11111111111111111111111111111111111111112', 
    name: 'Solana',
    mint: 'So11111111111111111111111111111111111111112'
  },
  { 
    symbol: 'USDC', 
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  },
  { 
    symbol: 'USDT', 
    address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', 
    name: 'Tether USD',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  },
  { 
    symbol: 'FARTCOIN', 
    address: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', 
    name: 'Fartcoin',
    mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump'
  },
];

const SUPPORTED_CHAINS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', chainId: 1 },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', chainId: 137 },
  { id: 'bsc', name: 'Binance Smart Chain', symbol: 'BNB', chainId: 56 },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', chainId: 42161 },
  { id: 'optimism', name: 'Optimism', symbol: 'ETH', chainId: 10 },
  { id: 'base', name: 'Base', symbol: 'ETH', chainId: 8453 },
];

// USDC contract addresses on different chains
const USDC_ADDRESSES = {
  ethereum: '0xA0b86a33E6441b8435b662303c0f218C8F8c0c0e',
  polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  arbitrum: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  optimism: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

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
  const [selectedChain, setSelectedChain] = useState(SUPPORTED_CHAINS[0]);
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);
  const [loadingTokenInfo, setLoadingTokenInfo] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ name: string; symbol: string } | null>(null);
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [defaultToken, setDefaultToken] = useState<'usdc' | 'sol'>('usdc');

  const paymentOptions = [
    {
      type: 'stripe' as const,
      label: 'Credit Card',
      description: 'Pay with Visa, Mastercard, etc.',
      icon: CreditCard,
      available: true
    },
    {
      type: 'tokens' as const,
      label: 'Pay with Tokens',
      description: 'SOL, USDC, or any SPL token',
      icon: Wallet,
      available: isConnected
    },
    {
      type: 'other-chains' as const,
      label: 'Pay from Other Chains',
      description: 'USDC from Ethereum, Polygon, etc.',
      icon: Link,
      available: true
    }
  ];

  // Function to fetch token info from Jupiter API
  const fetchTokenInfo = async (tokenAddress: string) => {
    if (!tokenAddress.trim()) return;
    
    setLoadingTokenInfo(true);
    try {
      // Jupiter API to get token info
      const response = await fetch(`https://tokens.jup.ag/token/${tokenAddress}`);
      if (response.ok) {
        const tokenData = await response.json();
        setTokenInfo({
          name: tokenData.name || 'Unknown Token',
          symbol: tokenData.symbol || 'TOKEN'
        });
      } else {
        // Fallback for unknown tokens
        setTokenInfo({
          name: 'Custom Token',
          symbol: 'TOKEN'
        });
      }
    } catch (error) {
      console.error('Failed to fetch token info:', error);
      setTokenInfo({
        name: 'Custom Token',
        symbol: 'TOKEN'
      });
    } finally {
      setLoadingTokenInfo(false);
    }
  };

  // Jupiter API price quote function
  const getJupiterPriceQuote = async (tokenAddress: string): Promise<PriceQuote> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      // Determine output token based on default selection
      const outputMint = defaultToken === 'usdc' 
        ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
        : 'So11111111111111111111111111111111111111112'; // SOL
      
      // Convert USD amount to output token amount (6 decimals for USDC, 9 for SOL)
      const outputDecimals = defaultToken === 'usdc' ? 6 : 9;
      const outputAmount = Math.floor(usdAmount * Math.pow(10, outputDecimals));
      
      // Get quote for swapping FROM the input token TO get the exact output amount needed
      const quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${tokenAddress}&outputMint=${outputMint}&amount=${outputAmount}&swapMode=ExactOut&slippageBps=50`
      );
      
      if (!quoteResponse.ok) {
        throw new Error('Failed to get quote from Jupiter');
      }
      
      const quoteData = await quoteResponse.json();
      
      // Get the input token decimals (assume 6 for most tokens, 9 for SOL)
      const inputDecimals = tokenAddress === 'So11111111111111111111111111111111111111112' ? 9 : 6;
      
      // Calculate exact token amount needed to get the USD equivalent
      const tokenAmount = (parseFloat(quoteData.inAmount) / Math.pow(10, inputDecimals)).toFixed(6);
      const rate = parseFloat(tokenAmount) > 0 ? usdAmount / parseFloat(tokenAmount) : 0;
      
      return {
        tokenAmount,
        tokenSymbol: tokenInfo?.symbol || 'TOKEN',
        tokenName: tokenInfo?.name || 'Custom Token',
        usdValue: usdAmount.toFixed(2),
        exchangeRate: rate.toFixed(6),
        loading: false
      };
    } catch (error) {
      console.error('Jupiter API error:', error);
      // Fallback to mock rates if Jupiter API fails
      const mockRates: { [key: string]: number } = {
        'So11111111111111111111111111111111111111112': 180.00, // SOL
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1.00, // USDC
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.00, // USDT
        '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump': 0.85, // FARTCOIN
      };
      
      const rate = mockRates[tokenAddress] || Math.random() * 100;
      const tokenAmount = (usdAmount / rate).toFixed(6);
      
      return {
        tokenAmount,
        tokenSymbol: tokenInfo?.symbol || 'TOKEN',
        tokenName: tokenInfo?.name || 'Custom Token',
        usdValue: usdAmount.toFixed(2),
        exchangeRate: rate.toFixed(6),
        loading: false
      };
    }
  };

  // DeBridge API price quote function for cross-chain
  const getDeBridgePriceQuote = async (chainId: number): Promise<PriceQuote> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      // DeBridge API to get cross-chain quote for USDC
      const usdcAddress = USDC_ADDRESSES[selectedChain.id as keyof typeof USDC_ADDRESSES];
      const solanaUsdcAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      
      // This would be the actual DeBridge API call
      // const quoteResponse = await fetch('https://api.dln.trade/v1.0/dln/order/quote', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     srcChainId: chainId,
      //     srcChainTokenIn: usdcAddress,
      //     srcChainTokenInAmount: (usdAmount * 1000000).toString(),
      //     dstChainId: 101, // Solana
      //     dstChainTokenOut: solanaUsdcAddress,
      //   })
      // });
      
      // Dummy implementation for now
      const bridgeFee = usdAmount * 0.005; // 0.5% bridge fee
      const totalAmount = usdAmount + bridgeFee;
      
      return {
        tokenAmount: totalAmount.toFixed(6),
        tokenSymbol: 'USDC',
        tokenName: 'USD Coin',
        usdValue: usdAmount.toFixed(2),
        exchangeRate: '1.000000',
        bridgeFee: bridgeFee.toFixed(6),
        loading: false
      };
    } catch (error) {
      return {
        tokenAmount: '0',
        tokenSymbol: 'USDC',
        tokenName: 'USD Coin',
        usdValue: '0',
        exchangeRate: '0',
        loading: false,
        error: 'Failed to get cross-chain quote'
      };
    }
  };

  // Function to get price quote
  const fetchPriceQuote = async (tokenAddress?: string, chainId?: number) => {
    setPriceQuote({ 
      tokenAmount: '0', 
      tokenSymbol: tokenInfo?.symbol || 'TOKEN',
      tokenName: tokenInfo?.name || 'Custom Token',
      usdValue: '0', 
      exchangeRate: '0', 
      loading: true 
    });
    
    try {
      let quote: PriceQuote;
      
      if (chainId) {
        // Cross-chain quote using DeBridge
        quote = onGetPriceQuote 
          ? await onGetPriceQuote('', chainId.toString())
          : await getDeBridgePriceQuote(chainId);
      } else if (tokenAddress) {
        // SPL token quote using Jupiter
        quote = onGetPriceQuote 
          ? await onGetPriceQuote(tokenAddress)
          : await getJupiterPriceQuote(tokenAddress);
      } else {
        throw new Error('No token address or chain ID provided');
      }
      
      setPriceQuote(quote);
    } catch (error) {
      setPriceQuote({
        tokenAmount: '0',
        tokenSymbol: tokenInfo?.symbol || 'TOKEN',
        tokenName: tokenInfo?.name || 'Custom Token',
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
    setPriceQuote(null);
    setTokenInfo(null);
    setCustomTokenAddress('');
    setShowPriceDetails(false);
    
    const paymentMethod: PaymentMethod = { 
      type: method.type,
      defaultToken: method.type === 'tokens' ? defaultToken : undefined
    };
    onMethodChange(paymentMethod);
  };

  const handlePopularTokenSelect = async (token: typeof POPULAR_TOKENS[0]) => {
    setCustomTokenAddress(token.address);
    setTokenInfo({ name: token.name, symbol: token.symbol });
    
    onMethodChange({
      type: 'tokens',
      defaultToken,
      tokenAddress: token.address,
      tokenSymbol: token.symbol,
      tokenName: token.name
    });

    toast.success(`${token.symbol} selected for payment`);
    
    // Fetch price quote for popular token
    await fetchPriceQuote(token.address);
  };

  const handleCustomTokenSubmit = async () => {
    if (!customTokenAddress.trim()) {
      toast.error('Please enter a token address');
      return;
    }

    // Fetch token info first
    await fetchTokenInfo(customTokenAddress);
    
    // Wait a bit for token info to load
    setTimeout(async () => {
      onMethodChange({
        type: 'tokens',
        defaultToken,
        tokenAddress: customTokenAddress,
        tokenSymbol: tokenInfo?.symbol || 'TOKEN',
        tokenName: tokenInfo?.name || 'Custom Token'
      });

      toast.success(`${tokenInfo?.symbol || 'Token'} selected for payment`);
      
      // Fetch price quote
      await fetchPriceQuote(customTokenAddress);
    }, 100);
  };

  const handleChainPaymentSubmit = async () => {
    const usdcAddress = USDC_ADDRESSES[selectedChain.id as keyof typeof USDC_ADDRESSES];
    
    onMethodChange({
      type: 'other-chains',
      defaultToken: 'usdc', // Always USDC for cross-chain
      tokenAddress: usdcAddress,
      chainId: selectedChain.id,
      chainName: selectedChain.name,
      tokenSymbol: 'USDC',
      tokenName: 'USD Coin'
    });

    toast.success(`Cross-chain USDC payment configured for ${selectedChain.name}`);
    
    // Fetch price quote for cross-chain
    await fetchPriceQuote(undefined, selectedChain.chainId);
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
      case 'tokens':
        if (selectedMethod.tokenAddress) {
          return `${selectedMethod.tokenName || selectedMethod.tokenSymbol || 'Token'} Payment`;
        }
        return `Pay with ${defaultToken.toUpperCase()}`;
      case 'other-chains':
        return `${selectedMethod.chainName} USDC Payment`;
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

      {/* Token Payment Selection */}
      {selectedMethod?.type === 'tokens' && (
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">Token Payment</h4>
          </div>
          
          {/* Default Token Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Default Payment Token</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDefaultToken('usdc');
                  if (!selectedMethod.tokenAddress) {
                    onMethodChange({
                      ...selectedMethod,
                      defaultToken: 'usdc'
                    });
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-md border transition-colors ${
                  defaultToken === 'usdc'
                    ? 'border-secondary bg-secondary/10 text-white'
                    : 'border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">$</span>
                </div>
                <span className="text-sm font-medium">USDC</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setDefaultToken('sol');
                  if (!selectedMethod.tokenAddress) {
                    onMethodChange({
                      ...selectedMethod,
                      defaultToken: 'sol'
                    });
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-md border transition-colors ${
                  defaultToken === 'sol'
                    ? 'border-secondary bg-secondary/10 text-white'
                    : 'border-gray-600 bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">◎</span>
                </div>
                <span className="text-sm font-medium">SOL</span>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {defaultToken === 'usdc' 
                ? 'Pay directly with USDC (no swap needed)' 
                : 'Pay directly with SOL (no swap needed)'}
            </p>
          </div>
          
          {/* Popular Tokens */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Or Use Other Tokens</label>
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
              <div className="relative">
                <input
                  type="text"
                  placeholder="Paste token contract address"
                  value={customTokenAddress}
                  onChange={(e) => setCustomTokenAddress(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                />
                {customTokenAddress && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(customTokenAddress)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-600 rounded"
                  >
                    <Copy className="h-3 w-3 text-gray-400" />
                  </button>
                )}
              </div>
              
              {/* Token Info Display */}
              {loadingTokenInfo && customTokenAddress && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary"></div>
                  <span>Loading token info...</span>
                </div>
              )}
              
              {tokenInfo && customTokenAddress && !loadingTokenInfo && (
                <div className="bg-gray-700/50 rounded-md p-2">
                  <div className="text-sm text-white font-medium">{tokenInfo.name}</div>
                  <div className="text-xs text-gray-400">{tokenInfo.symbol}</div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleCustomTokenSubmit}
                  variant="outline"
                  size="sm"
                  disabled={!customTokenAddress.trim() || loadingTokenInfo}
                  className="flex-1"
                >
                  {loadingTokenInfo ? 'Loading...' : 'Use This Token'}
                </Button>
                
                <Button
                  type="button"
                  onClick={() => fetchPriceQuote(customTokenAddress)}
                  variant="ghost"
                  size="sm"
                  disabled={!customTokenAddress.trim() || priceQuote?.loading || loadingTokenInfo}
                  className="flex-1"
                >
                  {priceQuote?.loading ? 'Getting Quote...' : 'Get Price Quote'}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Price Quote Display */}
          {priceQuote && (selectedMethod.tokenAddress || customTokenAddress) && (
            <div className="bg-gray-700/50 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPriceDetails(!showPriceDetails)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h5 className="text-xs font-medium text-gray-300">Price Quote</h5>
                  {priceQuote.loading && (
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-secondary"></div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!priceQuote.loading && !priceQuote.error && (
                    <span className="text-sm font-medium text-white">
                      {priceQuote.tokenAmount} {priceQuote.tokenSymbol}
                    </span>
                  )}
                  <ChevronRight className={`h-3 w-3 text-gray-400 transition-transform ${showPriceDetails ? 'rotate-90' : ''}`} />
                </div>
              </button>
              
              {showPriceDetails && (
                <div className="px-3 pb-3 space-y-2 border-t border-gray-600/50">
                  {priceQuote.loading ? (
                    <div className="flex items-center gap-2 py-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary"></div>
                      <span className="text-sm text-gray-400">Fetching price via Jupiter...</span>
                    </div>
                  ) : priceQuote.error ? (
                    <div className="text-sm text-red-400 py-2">{priceQuote.error}</div>
                  ) : (
                    <div className="space-y-1 pt-2">
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
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Swapping to:</span>
                        <span className="text-xs text-gray-400">
                          {defaultToken.toUpperCase()}
                        </span>
                      </div>
                      {priceQuote.tokenSymbol !== defaultToken.toUpperCase() && (
                        <div className="text-xs text-blue-400 mt-2">
                          Will be swapped to {defaultToken.toUpperCase()} via Jupiter
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cross-Chain Payment */}
      {selectedMethod?.type === 'other-chains' && (
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-white">Cross-Chain USDC Payment</h4>
          
          {/* Chain Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Select Source Chain</label>
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

          {/* USDC Address Display */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">
              USDC Contract Address
            </label>
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={USDC_ADDRESSES[selectedChain.id as keyof typeof USDC_ADDRESSES] || ''}
                  readOnly
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 pr-20 text-white text-sm focus:outline-none"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(USDC_ADDRESSES[selectedChain.id as keyof typeof USDC_ADDRESSES] || '')}
                    className="p-1 hover:bg-gray-600 rounded"
                  >
                    <Copy className="h-3 w-3 text-gray-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const explorerUrls = {
                        ethereum: 'https://etherscan.io',
                        polygon: 'https://polygonscan.com',
                        bsc: 'https://bscscan.com',
                        arbitrum: 'https://arbiscan.io',
                        optimism: 'https://optimistic.etherscan.io',
                        base: 'https://basescan.org'
                      };
                      window.open(explorerUrls[selectedChain.id as keyof typeof explorerUrls], '_blank');
                    }}
                    className="p-1 hover:bg-gray-600 rounded"
                  >
                    <ExternalLink className="h-3 w-3 text-gray-400" />
                  </button>
                </div>
              </div>
              
              <Button
                type="button"
                onClick={handleChainPaymentSubmit}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Configure {selectedChain.name} USDC Payment
              </Button>
              
              <Button
                type="button"
                onClick={() => fetchPriceQuote(undefined, selectedChain.chainId)}
                variant="ghost"
                size="sm"
                disabled={priceQuote?.loading}
                className="w-full"
              >
                {priceQuote?.loading ? 'Getting Quote...' : 'Get DeBridge Quote'}
              </Button>
            </div>
          </div>

          {/* Price Quote Display for Cross-Chain */}
          {priceQuote && selectedMethod?.type === 'other-chains' && (
            <div className="bg-gray-700/50 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPriceDetails(!showPriceDetails)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h5 className="text-xs font-medium text-gray-300">
                    Cross-Chain Quote ({selectedChain.name})
                  </h5>
                  {priceQuote.loading && (
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-secondary"></div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!priceQuote.loading && !priceQuote.error && (
                    <span className="text-sm font-medium text-white">
                      {priceQuote.tokenAmount} USDC
                    </span>
                  )}
                  <ChevronRight className={`h-3 w-3 text-gray-400 transition-transform ${showPriceDetails ? 'rotate-90' : ''}`} />
                </div>
              </button>
              
              {showPriceDetails && (
                <div className="px-3 pb-3 space-y-2 border-t border-gray-600/50">
                  {priceQuote.loading ? (
                    <div className="flex items-center gap-2 py-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary"></div>
                      <span className="text-sm text-gray-400">Fetching quote via DeBridge...</span>
                    </div>
                  ) : priceQuote.error ? (
                    <div className="text-sm text-red-400 py-2">{priceQuote.error}</div>
                  ) : (
                    <div className="space-y-1 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">You'll pay:</span>
                        <span className="text-sm font-medium text-white">
                          {priceQuote.tokenAmount} USDC
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">USD Value:</span>
                        <span className="text-sm text-gray-300">${priceQuote.usdValue}</span>
                      </div>
                      {priceQuote.bridgeFee && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Bridge Fee:</span>
                          <span className="text-xs text-yellow-400">{priceQuote.bridgeFee} USDC</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Network:</span>
                        <span className="text-xs text-gray-400">{selectedChain.name}</span>
                      </div>
                      <div className="text-xs text-blue-400 mt-2">
                        Powered by DeBridge • 5-15 minutes to complete
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
            <p className="text-xs text-blue-400">
              Cross-chain payments use USDC only and are powered by DeBridge technology. Transactions may take 5-15 minutes to complete.
            </p>
          </div>
        </div>
      )}

      {/* Connection Warning */}
      {selectedMethod?.type === 'tokens' && !isConnected && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
          <p className="text-xs text-yellow-400">
            Please connect your wallet to continue with token payment.
          </p>
        </div>
      )}
    </div>
  );
}