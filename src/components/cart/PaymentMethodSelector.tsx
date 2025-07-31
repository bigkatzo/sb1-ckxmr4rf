import React, { useState, useEffect } from 'react';
import { Coins, CreditCard, Wallet, Link, Search, Copy, Check, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, ChevronRight } from 'lucide-react';
// Import from App.tsx temporarily - you should move these to proper UI components
import { Button } from '../ui/Button';
import { toast } from 'react-toastify';
import { TokenIcon } from '../ui/TokenIcon';
import { tokenService } from '../../services/tokenService';

export interface PaymentMethod {
  type: 'default' | 'stripe' | 'spl-tokens' | 'cross-chain';
  defaultToken?: 'usdc' | 'sol' | 'merchant';
  tokenAddress?: string;
  chainId?: string;
  tokenSymbol?: string;
  tokenName?: string;
  chainName?: string;
}

export interface RecommendedCAInput {
  address: string;
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

export interface RecommendedCA {
  address: string;
  symbol: string;
  name: string;
  decimals?: number;
  logoUrl?: string;
}
interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onMethodChange: (method: PaymentMethod) => void;
  isConnected: boolean;
  disabled?: boolean;
  currency: 'sol' | 'usdc'; // Currency from useCurrency()
  totalAmount: number; // Total amount in the base currency
  onGetPriceQuote?: (tokenAddress: string, chainId?: string) => Promise<PriceQuote>;
  onTotalPriceChange?: (totalPrice: string, tokenSymbol: string) => void;
  recommendedCAs?: string[]; // Array of token addresses
  solRate?: number; // Optional SOL rate for USD conversion
}

const POPULAR_TOKENS = [
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
  { 
    symbol: 'BONK', 
    address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', 
    name: 'Bonk',
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
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
  currency,
  totalAmount,
  onGetPriceQuote,
  onTotalPriceChange,
  solRate,
  recommendedCAs = []
}: PaymentMethodSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [selectedChain, setSelectedChain] = useState(SUPPORTED_CHAINS[0]);
  const [priceQuote, setPriceQuote] = useState<PriceQuote | null>(null);
  const [loadingTokenInfo, setLoadingTokenInfo] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ name: string; symbol: string; logoUrl?: string } | null>(null);
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [defaultToken, setDefaultToken] = useState<'usdc' | 'sol' | 'merchant'>('usdc');
  const [showCustomTokenInput, setShowCustomTokenInput] = useState(false);
  const [defaultTokenQuote, setDefaultTokenQuote] = useState<PriceQuote | null>(null);
  const [fetchedRecommendedCAs, setFetchedRecommendedCAs] = useState<RecommendedCA[]>([]);
  const [loadingRecommendedCAs, setLoadingRecommendedCAs] = useState(false);

  // Helper function to format price quotes
  const formatPriceQuote = (amount: string, tokenName: string): string => {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return `${amount} ${tokenName}`;
    return `${numericAmount.toFixed(2)} ${tokenName}`;
  };

  // Set default token based on currency context
  React.useEffect(() => {
    setDefaultToken(currency);
  }, [currency]);

  // Get the first available fetched recommended CA
  const firstRecommendedCA = fetchedRecommendedCAs && fetchedRecommendedCAs.length > 0 ? fetchedRecommendedCAs[0] : null;
  const hasMerchantToken = !!firstRecommendedCA;

  // Function to fetch token info from Jupiter API for multiple addresses
  const fetchRecommendedCAInfo = async (addresses: string[]) => {
    if (!addresses || addresses.length === 0) {
      setFetchedRecommendedCAs([]);
      return;
    }

    setLoadingRecommendedCAs(true);
    try {
      // Use the new token service to fetch multiple tokens at once
      const tokenInfos = await tokenService.getMultipleTokens(addresses);
      
      const results = tokenInfos.map((tokenInfo, index) => ({
        address: addresses[index],
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals || 6,
        logoUrl: tokenInfo.logoURI
      }));

      setFetchedRecommendedCAs(results);
    } catch (error) {
      console.error('Failed to fetch recommended CA info:', error);
      setFetchedRecommendedCAs([]);
    } finally {
      setLoadingRecommendedCAs(false);
    }
  };

  // Effect to fetch recommended CA info when recommendedCAs prop changes
  React.useEffect(() => {
    if (recommendedCAs && recommendedCAs.length > 0) {
      fetchRecommendedCAInfo(recommendedCAs);
    } else {
      setFetchedRecommendedCAs([]);
    }
  }, [recommendedCAs]);

  const paymentOptions = [
    {
      type: 'default' as const,
      label: 'Default',
      description: 'Quick payment with USDC or SOL',
      icon: Coins,
      available: isConnected
    },
    {
      type: 'stripe' as const,
      label: 'Credit Card',
      description: 'Pay with Visa, Mastercard, etc.',
      icon: CreditCard,
      available: true
    },
    {
      type: 'spl-tokens' as const,
      label: 'Pay with SPL Tokens',
      description: 'Pay with any Solana token',
      icon: Wallet,
      available: isConnected
    },
    {
      type: 'cross-chain' as const,
      label: 'Cross-Chain Payment',
      description: 'USDC from other blockchains',
      icon: Link,
      available: true
    }
  ];

  // Function to fetch token info using the new token service
  const fetchTokenInfo = async (tokenAddress: string) => {
    if (!tokenAddress.trim()) return;
    
    setLoadingTokenInfo(true);
    try {
      const tokenInfo = await tokenService.getTokenInfo(tokenAddress);
      setTokenInfo({
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        logoUrl: tokenInfo.logoURI
      });
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
      // Use the base currency for conversion
      const outputMint = currency === 'usdc' 
        ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
        : 'So11111111111111111111111111111111111111112'; // SOL
      
      const outputDecimals = currency === 'usdc' ? 6 : 9;
      const outputAmount = Math.floor(totalAmount * Math.pow(10, outputDecimals));
      
      const quoteResponse = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${outputMint}&outputMint=${tokenAddress}&amount=${outputAmount}&slippageBps=50`
      );
      
      if (!quoteResponse.ok) {
        throw new Error('Failed to get quote from Jupiter');
      }
      
      const quoteData = await quoteResponse.json();
      
      // Get token decimals - assume 6 for most SPL tokens, 9 for SOL
      const tokenDecimals = tokenAddress === 'So11111111111111111111111111111111111111112' ? 9 : 6;
      const tokenAmount = (parseFloat(quoteData.outAmount) / Math.pow(10, tokenDecimals)).toFixed(6);
      const rate = parseFloat(tokenAmount) > 0 ? totalAmount / parseFloat(tokenAmount) : 0;
      
      return {
        tokenAmount,
        tokenSymbol: tokenInfo?.symbol || 'TOKEN',
        tokenName: tokenInfo?.name || 'Custom Token',
        usdValue: totalAmount.toFixed(6),
        exchangeRate: (1 / rate).toFixed(6),
        loading: false
      };
    } catch (error) {
      console.error('Jupiter API error:', error);
      const mockRates: { [key: string]: number } = {
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.00, // USDT
        '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump': 0.85, // FARTCOIN
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 0.000025, // BONK
      };
      
      const rate = mockRates[tokenAddress] || Math.random() * 100;
      const tokenAmount = (totalAmount / rate).toFixed(6);
      
      return {
        tokenAmount,
        tokenSymbol: tokenInfo?.symbol || 'TOKEN',
        tokenName: tokenInfo?.name || 'Custom Token',
        usdValue: totalAmount.toFixed(6),
        exchangeRate: rate.toFixed(6),
        loading: false
      };
    }
  };

  // DeBridge API price quote function for cross-chain
  const getDeBridgePriceQuote = async (chainId: number): Promise<PriceQuote> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      const bridgeFee = totalAmount * 0.005; // 0.5% bridge fee
      const totalAmountWithFee = totalAmount + bridgeFee;
      
      return {
        tokenAmount: totalAmountWithFee.toFixed(6),
        tokenSymbol: 'USDC',
        tokenName: 'USD Coin',
        usdValue: totalAmount.toFixed(6),
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

  const fetchDefaultTokenQuote = async (targetToken: 'usdc' | 'sol' | 'merchant') => {
    // If target token matches the base currency, no conversion needed
    if (targetToken === currency || targetToken === 'merchant') {
      const directQuote = {
        tokenAmount: totalAmount.toFixed(6),
        tokenSymbol: currency.toUpperCase(),
        tokenName: currency === 'usdc' ? 'USD Coin' : 'Solana',
        usdValue: totalAmount.toFixed(6),
        exchangeRate: '1.000000',
        loading: false
      };
      setDefaultTokenQuote(directQuote);
      
      // Update total price display
      if (onTotalPriceChange) {
        onTotalPriceChange(directQuote.tokenAmount, currency.toUpperCase());
      }
      return;
    }

    setDefaultTokenQuote({
      tokenAmount: '0',
      tokenSymbol: targetToken.toUpperCase(),
      tokenName: targetToken === 'sol' ? 'Solana' : 'Merchant Token',
      usdValue: '0',
      exchangeRate: '0',
      loading: true
    });

    try {
      // Convert between SOL and USDC
      if (targetToken === 'sol' && currency === 'usdc') {
        // Convert USDC to SOL
        const solMint = 'So11111111111111111111111111111111111111112';
        const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const usdcAmount = Math.floor(totalAmount * Math.pow(10, 6)); // USDC has 6 decimals
        
        const quoteResponse = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${usdcMint}&outputMint=${solMint}&amount=${usdcAmount}&slippageBps=50`
        );
        
        if (quoteResponse.ok) {
          const quoteData = await quoteResponse.json();
          const solAmount = (parseFloat(quoteData.outAmount) / Math.pow(10, 9)).toFixed(6); // SOL has 9 decimals
          const rate = parseFloat(solAmount) > 0 ? totalAmount / parseFloat(solAmount) : 0;
          
          const solQuote = {
            tokenAmount: solAmount,
            tokenSymbol: 'SOL',
            tokenName: 'Solana',
            usdValue: totalAmount.toFixed(6),
            exchangeRate: rate.toFixed(2),
            loading: false
          };
          setDefaultTokenQuote(solQuote);
          
          // Update total price display
          if (onTotalPriceChange) {
            onTotalPriceChange(solQuote.tokenAmount, 'SOL');
          }
        } else {
          throw new Error('Failed to get SOL quote');
        }
      } else if (targetToken === 'usdc' && currency === 'sol') {
        // Convert SOL to USDC
        const solMint = 'So11111111111111111111111111111111111111112';
        const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const solAmount = Math.floor(totalAmount * Math.pow(10, 9)); // SOL has 9 decimals
        
        const quoteResponse = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${solMint}&outputMint=${usdcMint}&amount=${solAmount}&slippageBps=50`
        );
        
        if (quoteResponse.ok) {
          const quoteData = await quoteResponse.json();
          const usdcAmount = (parseFloat(quoteData.outAmount) / Math.pow(10, 6)).toFixed(6); // USDC has 6 decimals
          const rate = parseFloat(usdcAmount) > 0 ? totalAmount / parseFloat(usdcAmount) : 0;
          
          const usdcQuote = {
            tokenAmount: usdcAmount,
            tokenSymbol: 'USDC',
            tokenName: 'USD Coin',
            usdValue: totalAmount.toFixed(6),
            exchangeRate: (1 / rate).toFixed(2),
            loading: false
          };
          setDefaultTokenQuote(usdcQuote);
          
          // Update total price display
          if (onTotalPriceChange) {
            onTotalPriceChange(usdcQuote.tokenAmount, 'USDC');
          }
        } else {
          throw new Error('Failed to get USDC quote');
        }
      }
    } catch (error) {
      console.error(`Failed to get ${targetToken} quote:`, error);
      // Fallback to mock data
      const mockRates = { sol: 100, usdc: 1, merchant: 0.5 };
      const rate = mockRates[targetToken as keyof typeof mockRates];
      const tokenAmount = (totalAmount / rate).toFixed(6);
      
      const fallbackQuote = {
        tokenAmount,
        tokenSymbol: targetToken.toUpperCase(),
        tokenName: targetToken === 'sol' ? 'Solana' : targetToken === 'usdc' ? 'USD Coin' : 'Merchant Token',
        usdValue: totalAmount.toFixed(6),
        exchangeRate: rate.toFixed(6),
        loading: false,
        error: 'Using fallback rates'
      };
      setDefaultTokenQuote(fallbackQuote);
      
      // Update total price display
      if (onTotalPriceChange) {
        onTotalPriceChange(fallbackQuote.tokenAmount, fallbackQuote.tokenSymbol);
      }
    }
  };

  // Simple USD conversion for credit card display
  const getUSDEquivalent = () => {
    if (currency === 'usdc') return totalAmount;
    const solToUsdRate = solRate ?? 180; // Example: 1 SOL = $100
    return totalAmount * solToUsdRate;
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
        quote = onGetPriceQuote 
          ? await onGetPriceQuote('', chainId.toString())
          : await getDeBridgePriceQuote(chainId);
      } else if (tokenAddress) {
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
    setDefaultTokenQuote(null);
    setTokenInfo(null);
    setCustomTokenAddress('');
    setShowPriceDetails(false);
    setShowCustomTokenInput(false);
    
    const paymentMethod: PaymentMethod = { 
      type: method.type,
      defaultToken: method.type === 'default' ? defaultToken : undefined
    };
    onMethodChange(paymentMethod);
    
    // Reset total price display when changing payment methods
    if (onTotalPriceChange && method.type !== 'default') {
      onTotalPriceChange(totalAmount.toFixed(6), currency.toUpperCase());
    }
  };

  // Handle merchant token selection - automatically switch to SPL tokens
  const handleMerchantTokenSelect = () => {
    if (!firstRecommendedCA) {
      toast.error('No merchant token available');
      return;
    }

    const merchantTokenAddress = firstRecommendedCA.address;
    const merchantTokenInfo = {
      name: firstRecommendedCA.name,
      symbol: firstRecommendedCA.symbol,
      logoUrl: firstRecommendedCA.logoUrl
    };
    
    setCustomTokenAddress(merchantTokenAddress);
    setTokenInfo(merchantTokenInfo);
    setShowCustomTokenInput(true);
    setDefaultTokenQuote(null);
    
    // Switch to SPL tokens method
    onMethodChange({
      type: 'spl-tokens',
      tokenAddress: merchantTokenAddress,
      tokenSymbol: merchantTokenInfo.symbol,
      tokenName: merchantTokenInfo.name
    });

    toast.success(`${firstRecommendedCA.symbol} selected for payment`);
  };

  const handlePopularTokenSelect = async (token: typeof POPULAR_TOKENS[0]) => {
    setCustomTokenAddress(token.address);
    setTokenInfo({ name: token.name, symbol: token.symbol });
    setPriceQuote(null);
    
    onMethodChange({
      type: 'spl-tokens',
      tokenAddress: token.address,
      tokenSymbol: token.symbol,
      tokenName: token.name
    });

    toast.success(`${token.symbol} selected for payment`);
    await fetchPriceQuote(token.address);
  };

  const handleCustomTokenSubmit = async () => {
    if (!customTokenAddress.trim()) {
      toast.error('Please enter a token address');
      return;
    }

    await fetchTokenInfo(customTokenAddress);
    
    setTimeout(async () => {
      setPriceQuote(null);
      
      onMethodChange({
        type: 'spl-tokens',
        tokenAddress: customTokenAddress,
        tokenSymbol: tokenInfo?.symbol || 'TOKEN',
        tokenName: tokenInfo?.name || 'Custom Token'
      });

      toast.success(`${tokenInfo?.symbol || 'Token'} selected for payment`);
      await fetchPriceQuote(customTokenAddress);
    }, 100);
  };

  const handleChainPaymentSubmit = async () => {
    const usdcAddress = USDC_ADDRESSES[selectedChain.id as keyof typeof USDC_ADDRESSES];
    
    setPriceQuote(null);
    
    onMethodChange({
      type: 'cross-chain',
      tokenAddress: usdcAddress,
      chainId: selectedChain.id,
      chainName: selectedChain.name,
      tokenSymbol: 'USDC',
      tokenName: 'USD Coin'
    });

    toast.success(`Cross-chain USDC payment configured for ${selectedChain.name}`);
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
      case 'default':
        return `Pay with ${selectedMethod.defaultToken?.toUpperCase() || 'USDC'}`;
      case 'stripe':
        return 'Credit Card';
      case 'spl-tokens':
        if (selectedMethod.tokenAddress) {
          return `${selectedMethod.tokenName || selectedMethod.tokenSymbol || 'Token'} Payment`;
        }
        return 'Pay with SPL Tokens';
      case 'cross-chain':
        return `${selectedMethod.chainName} USDC Payment`;
      default:
        return 'Select Payment Method';
    }
  };

  // Render default token selection buttons
  const renderDefaultTokenButtons = () => {
    return (
      selectedMethod?.type === 'default' && (
        <div className="space-y-4 mt-4 pt-4">
          <div className="flex justify-center">
            <div className="flex items-center bg-gray-800 rounded-full p-1 border border-gray-700 gap-1">
              {/* USDC - Show conversion quote if base currency is SOL */}
              <button
                type="button"
                onClick={async () => {
                  setDefaultToken('usdc');
                  onMethodChange({ type: 'default', defaultToken: 'usdc' });
                  await fetchDefaultTokenQuote('usdc');
                }}
                className={`px-4 py-2 rounded-full transition-colors text-sm flex items-center gap-2 ${
                  selectedMethod?.defaultToken === 'usdc'
                    ? 'bg-secondary text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <TokenIcon symbol="USDC" size="sm" />
                USDC
              </button>

              {/* SOL - Show conversion quote if base currency is USDC */}
              <button
                type="button"
                onClick={async () => {
                  setDefaultToken('sol');
                  onMethodChange({ type: 'default', defaultToken: 'sol' });
                  await fetchDefaultTokenQuote('sol');
                }}
                className={`px-4 py-2 rounded-full transition-colors text-sm flex items-center gap-2 ${
                  selectedMethod?.defaultToken === 'sol'
                    ? 'bg-secondary text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <TokenIcon symbol="SOL" size="sm" />
                SOL
              </button>

              {/* MERCHANT - Only show if we have a recommended CA */}
              {hasMerchantToken && !loadingRecommendedCAs && (
                <button
                  type="button"
                  onClick={async () => {
                    await fetchDefaultTokenQuote('merchant');
                    handleMerchantTokenSelect();
                  }}
                  className={`px-4 py-2 rounded-full transition-colors text-sm flex items-center gap-2 ${
                    selectedMethod?.defaultToken === 'merchant'
                      ? 'bg-secondary text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <TokenIcon symbol={firstRecommendedCA.symbol} size="sm" />
                  {firstRecommendedCA.symbol}
                </button>
              )}

              {/* Loading state for recommended CAs */}
              {loadingRecommendedCAs && recommendedCAs && recommendedCAs.length > 0 && (
                <div className="px-4 py-2 rounded-full bg-gray-700 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b border-secondary"></div>
                  <span className="text-sm text-gray-400">Loading...</span>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            {selectedMethod?.defaultToken === 'usdc'
              ? currency === 'usdc' ? 'Pay with USDC (no swap)' : 'Pay with USDC (converted from SOL)'
              : selectedMethod?.defaultToken === 'sol'
              ? currency === 'sol' ? 'Pay with SOL (no swap)' : 'Pay with SOL (converted from USDC)'
              : hasMerchantToken && firstRecommendedCA
              ? `Pay with ${firstRecommendedCA.symbol} token (no swap)`
              : 'Pay with selected token (no swap)'}
          </p>

          {/* Default Token Price Quote Display */}
          {defaultTokenQuote && selectedMethod?.defaultToken !== currency && (
            <div className="bg-gray-700/50 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPriceDetails(!showPriceDetails)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <h5 className="text-sm font-medium text-gray-300">
                    Conversion Quote ({currency.toUpperCase()} → {selectedMethod?.defaultToken?.toUpperCase()})
                  </h5>
                  {defaultTokenQuote.loading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b border-secondary"></div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!defaultTokenQuote.loading && !defaultTokenQuote.error && (
                    <span className="text-sm font-medium text-white">
                      {formatPriceQuote(defaultTokenQuote.tokenAmount, defaultTokenQuote.tokenName)}
                    </span>
                  )}
                  <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${showPriceDetails ? 'rotate-90' : ''}`} />
                </div>
              </button>
              
              {showPriceDetails && (
                <div className="px-3 pb-3 space-y-2 border-t border-gray-600/50">
                  {defaultTokenQuote.loading ? (
                    <div className="flex items-center gap-2 py-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary"></div>
                      <span className="text-sm text-gray-400">Fetching {defaultTokenQuote.tokenSymbol} price...</span>
                    </div>
                  ) : defaultTokenQuote.error ? (
                    <div className="text-sm text-red-400 py-2">{defaultTokenQuote.error}</div>
                  ) : (
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">You'll pay:</span>
                        <span className="text-sm font-medium text-white">
                          {formatPriceQuote(defaultTokenQuote.tokenAmount, defaultTokenQuote.tokenName)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">USD Value:</span>
                        <span className="text-sm text-gray-300">${defaultTokenQuote.usdValue}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Current Rate:</span>
                        <span className="text-xs text-gray-400">
                          1 {defaultTokenQuote.tokenSymbol} = ${defaultTokenQuote.exchangeRate}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )
    );
  };

  return (
    <div className="space-y-4 border-t border-gray-800 mt-4 pt-4">
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

      {/* Default Payment Method Selection */}
      {selectedMethod?.type === 'default' && (
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">Select Default Token</h4>
          </div>
          
          {renderDefaultTokenButtons()}
          
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
            <p className="text-xs text-blue-400">
              Quick payment options.{hasMerchantToken && firstRecommendedCA ? ` Selecting ${firstRecommendedCA.symbol} will open up the recommended token by merchant.` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Credit Card USD Quote */}
      {selectedMethod?.type === 'stripe' && currency === 'sol' && (
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">USD Equivalent:</span>
            <span className="text-sm font-medium text-white">
              ${getUSDEquivalent().toFixed(2)} USD
            </span>
          </div>
        </div>
      )}

      {/* SPL Token Payment Selection */}
      {selectedMethod?.type === 'spl-tokens' && (
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">Select SPL Token</h4>
          </div>
          
          {/* Token Selection Grid */}
          <div>
            <div className="grid grid-cols-2 gap-3">
              {POPULAR_TOKENS.slice(0, 3).map((token) => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => handlePopularTokenSelect(token)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    selectedMethod.tokenAddress === token.address
                      ? 'border-secondary bg-secondary/10'
                      : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <TokenIcon symbol={token.symbol} size="sm" />
                  <div className="text-left flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{token.symbol}</div>
                    <div className="text-xs text-gray-400 truncate">{token.name}</div>
                  </div>
                </button>
              ))}
              
              {/* Custom Token Button */}
              <button
                type="button"
                onClick={() => setShowCustomTokenInput(!showCustomTokenInput)}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  showCustomTokenInput
                    ? 'border-secondary bg-secondary/10'
                    : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                  <span className="text-xs font-bold text-white">+</span>
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">Custom</div>
                  <div className="text-xs text-gray-400">Enter token address</div>
                </div>
              </button>
            </div>
          </div>

          {/* Custom Token Input */}
          {(showCustomTokenInput || (firstRecommendedCA && selectedMethod.tokenSymbol === firstRecommendedCA.symbol)) && (
            <div className="space-y-3 p-3 bg-gray-700/30 rounded-lg border border-gray-600">
              <label className="block text-xs font-medium text-gray-300">
                {firstRecommendedCA && selectedMethod.tokenSymbol === firstRecommendedCA.symbol 
                  ? `${firstRecommendedCA.name} Selected` 
                  : 'Enter Custom Token Address'
                }
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={firstRecommendedCA && selectedMethod.tokenSymbol === firstRecommendedCA.symbol 
                    ? `${firstRecommendedCA.name} token address` 
                    : 'Paste token contract address'
                  }
                  value={customTokenAddress}
                  onChange={(e) => setCustomTokenAddress(e.target.value)}
                  readOnly={!!(firstRecommendedCA && selectedMethod.tokenSymbol === firstRecommendedCA.symbol)}
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
                <div className="bg-gray-700/50 rounded-md p-3 flex items-center gap-3">
                  <TokenIcon symbol={tokenInfo.symbol} size="sm" logoUrl={tokenInfo.logoUrl} />
                  <div>
                    <div className="text-sm text-white font-medium">{tokenInfo.name}</div>
                    <div className="text-xs text-gray-400">{tokenInfo.symbol}</div>
                  </div>
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
          )}
          
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
                    <span className="text-sm font-medium text-white flex items-center gap-1">
                      {formatPriceQuote(priceQuote.tokenAmount, tokenInfo?.name || priceQuote.tokenName)}
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
                          {formatPriceQuote(priceQuote.tokenAmount, tokenInfo?.name || priceQuote.tokenName)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Equivalent to:</span>
                        <span className="text-sm text-gray-300">{priceQuote.usdValue} {currency.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Exchange Rate:</span>
                        <span className="text-xs text-gray-400">
                          1 {tokenInfo?.symbol || priceQuote.tokenSymbol} = {priceQuote.exchangeRate} {currency.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Swapping to:</span>
                        <span className="text-xs text-gray-400">
                          {currency.toUpperCase()}
                        </span>
                      </div>
                      {priceQuote.tokenSymbol !== currency.toUpperCase() && (
                        <div className="text-xs text-blue-400 mt-2">
                          Will be swapped to {currency.toUpperCase()} via Jupiter
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
      {selectedMethod?.type === 'cross-chain' && (
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-white">Cross-Chain USDC Payment</h4>
          
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
                Get {selectedChain.name} Quote
              </Button>
            </div>
          </div>

          {/* Price Quote Display for Cross-Chain */}
          {priceQuote && selectedMethod?.type === 'cross-chain' && (
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
                      {formatPriceQuote(priceQuote.tokenAmount, 'USDC')}
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
                          {formatPriceQuote(priceQuote.tokenAmount, 'USDC')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Equivalent to:</span>
                        <span className="text-sm text-gray-300">{priceQuote.usdValue} {currency.toUpperCase()}</span>
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
      {(selectedMethod?.type === 'default' || selectedMethod?.type === 'spl-tokens') && !isConnected && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
          <p className="text-xs text-yellow-400">
            Please connect your wallet to continue with this payment method.
          </p>
        </div>
      )}
    </div>
  );
}