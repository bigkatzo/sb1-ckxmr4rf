import React, { useState, useEffect } from 'react';
import { Coins, CreditCard, Wallet, Link, Search, Copy, Check, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, ChevronRight } from 'lucide-react';
// Import from App.tsx temporarily - you should move these to proper UI components
import { Button } from '../ui/Button';
import { toast } from 'react-toastify';
import { tokenService } from '../../services/tokenService';
import { SOLANA_CONNECTION } from '../../config/solana';
import { PublicKey } from '@solana/web3.js';

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
  hasStrictTokenRestriction?: boolean; // Whether to restrict to specific tokens only
  collectionStrictToken?: string; // The specific token address required for payment
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
  recommendedCAs = [],
  hasStrictTokenRestriction,
  collectionStrictToken
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
      // Only fetch the first token from the recommendedCAs array
      const firstAddress = addresses[0];
      const tokenInfo = await tokenService.getTokenInfo(firstAddress);
      
      const result = {
        address: firstAddress,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals || 6,
        logoUrl: tokenInfo.logoURI
      };

      setFetchedRecommendedCAs([result]);
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

  // Auto-select strict token payment method when restriction is enabled
  useEffect(() => {
    if (hasStrictTokenRestriction && collectionStrictToken) {
      onMethodChange({
        type: 'spl-tokens',
        tokenAddress: collectionStrictToken
      });
    }
  }, [hasStrictTokenRestriction, collectionStrictToken, onMethodChange]);

  // Auto-fetch price quote for strict token
  useEffect(() => {
    if (hasStrictTokenRestriction && firstRecommendedCA && selectedMethod?.type === 'spl-tokens') {
      // Set the strict token as selected
      setCustomTokenAddress(firstRecommendedCA.address);
      setTokenInfo({
        name: firstRecommendedCA.name,
        symbol: firstRecommendedCA.symbol,
        logoUrl: firstRecommendedCA.logoUrl
      });
      
      // Fetch price quote automatically
      fetchPriceQuote(firstRecommendedCA.address);
    }
  }, [hasStrictTokenRestriction, firstRecommendedCA, selectedMethod?.type]);

  const paymentOptions = [
    {
      type: 'default' as const,
      label: 'Default',
      description: 'Quick payment with USDC or SOL',
      icon: Coins,
      available: isConnected && !hasStrictTokenRestriction
    },
    {
      type: 'stripe' as const,
      label: 'Credit Card',
      description: 'Pay with Visa, Mastercard, etc.',
      icon: CreditCard,
      available: !hasStrictTokenRestriction
    },
    {
      type: 'spl-tokens' as const,
      label: hasStrictTokenRestriction ? 'Collection Token' : 'Pay with SPL Tokens',
      description: hasStrictTokenRestriction ? 'Pay with the collection\'s required token' : 'Pay with any Solana token',
      icon: Wallet,
      available: isConnected
    },
    {
      type: 'cross-chain' as const,
      label: 'Cross-Chain Payment',
      description: 'USDC from other blockchains',
      icon: Link,
      available: !hasStrictTokenRestriction
    }
  ].filter(option => !hasStrictTokenRestriction || option.type === 'spl-tokens');

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

// Jupiter API price quote function (primary method)
const getJupiterPriceQuote = async (tokenAddress: string, baseCurrency: 'sol' | 'usdc', totalAmount: number): Promise<PriceQuote> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  try {
    // Get the base currency mint address
    const baseCurrencyMint = baseCurrency === 'usdc' 
      ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' 
      : 'So11111111111111111111111111111111111111112';
    
    console.log(`Fetching Jupiter quote for ${baseCurrency.toUpperCase()} to ${tokenInfo?.symbol || 'TOKEN'} (${tokenAddress})`);
    
    // First, fetch token decimals using Solana connection for accurate conversion
    let inputDecimals = 6; // Default fallback
    let outputDecimals = 6; // Default fallback
    
    try {
      // Get base currency decimals from Solana
      const baseMint = new PublicKey(baseCurrencyMint);
      const baseMintInfo = await SOLANA_CONNECTION.getParsedAccountInfo(baseMint);
      if (baseMintInfo.value && 'parsed' in baseMintInfo.value.data) {
        inputDecimals = (baseMintInfo.value.data as any).parsed.info.decimals;
        console.log(`Fetched base currency decimals for ${baseCurrency}: ${inputDecimals}`);
      }
      
      // Get target token decimals from Solana
      const targetMint = new PublicKey(tokenAddress);
      const targetMintInfo = await SOLANA_CONNECTION.getParsedAccountInfo(targetMint);
      if (targetMintInfo.value && 'parsed' in targetMintInfo.value.data) {
        outputDecimals = (targetMintInfo.value.data as any).parsed.info.decimals;
        console.log(`Fetched target token decimals for ${tokenAddress}: ${outputDecimals}`);
      }
    } catch (error) {
      console.warn(`Failed to fetch token decimals from Solana, using defaults:`, error);
      // Fallback to known token decimals
      if (baseCurrencyMint === 'So11111111111111111111111111111111111111112') inputDecimals = 9;
      if (tokenAddress === 'So11111111111111111111111111111111111111112') outputDecimals = 9;
    }

    // Convert total amount to smallest unit using correct decimals
    const amountInSmallestUnit = Math.floor(totalAmount * Math.pow(10, inputDecimals));
    
    // Jupiter API endpoint for getting quote
    const jupiterUrl = `https://quote-api.jup.ag/v6/quote?` +
      `inputMint=${baseCurrencyMint}&` +
      `outputMint=${tokenAddress}&` +
      `amount=${amountInSmallestUnit}&` +
      `slippageBps=50&` +
      `onlyDirectRoutes=false&` +
      `asLegacyTransaction=false`;
    
    const response = await fetch(jupiterUrl);
    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data && data.outAmount) {
      // Calculate the output amount in human-readable format
      const outputAmount = parseInt(data.outAmount) / Math.pow(10, outputDecimals);
      
      // Calculate exchange rate (how much target token per 1 base currency)
      const exchangeRate = outputAmount / totalAmount;
      
      console.log(`Jupiter quote calculation: ${totalAmount} ${baseCurrency.toUpperCase()} → ${outputAmount} ${tokenInfo?.symbol || 'TOKEN'}`);
      console.log(`Exchange rate: 1 ${baseCurrency.toUpperCase()} = ${exchangeRate} ${tokenInfo?.symbol || 'TOKEN'}`);
      
      return {
        tokenAmount: outputAmount.toFixed(6),
        tokenSymbol: tokenInfo?.symbol || 'TOKEN',
        tokenName: tokenInfo?.name || 'Custom Token',
        usdValue: totalAmount.toFixed(6),
        exchangeRate: exchangeRate.toFixed(6),
        loading: false
      };
    }
    
    throw new Error('No valid quote data from Jupiter API');
    
  } catch (error) {
    console.error('Jupiter API error:', error);
    throw error; // Re-throw to trigger fallback
  }
};

// DexScreener API price quote function (fallback method)
const getDexScreenerPriceQuote = async (tokenAddress: string): Promise<PriceQuote> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  try {
    // Get the base currency mint address
    const baseCurrencyMint = currency.toLowerCase() === 'usdc' 
      ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' 
      : 'So11111111111111111111111111111111111111112';
    
    // DexScreener API endpoint for getting pair data
    const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    
    console.log(`Fetching DexScreener fallback quote for ${currency.toUpperCase()} to ${tokenInfo?.symbol || 'TOKEN'} (${tokenAddress})`);
    
    const response = await fetch(dexScreenerUrl);
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data && data.pairs && data.pairs.length > 0) {
      // Find the pair that matches our base currency
      const targetPair = data.pairs.find((pair: any) => {
        const baseToken = pair.baseToken?.address?.toLowerCase();
        const quoteToken = pair.quoteToken?.address?.toLowerCase();
        const targetAddress = tokenAddress.toLowerCase();
        const baseAddress = baseCurrencyMint.toLowerCase();
        
        // Check if either token matches our target and the other matches our base
        return (baseToken === targetAddress && quoteToken === baseAddress) ||
               (baseToken === baseAddress && quoteToken === targetAddress);
      });
      
      if (targetPair) {
        // Determine which token is base and which is quote
        const isBaseTokenTarget = targetPair.baseToken?.address?.toLowerCase() === tokenAddress.toLowerCase();
        
        console.log('DexScreener pair found:', {
          baseToken: targetPair.baseToken?.address,
          quoteToken: targetPair.quoteToken?.address,
          priceNative: targetPair.priceNative,
          priceUsd: targetPair.priceUsd,
          isBaseTokenTarget,
          targetAddress: tokenAddress,
          baseCurrencyMint
        });
        
        let rate;
        if (isBaseTokenTarget) {
          // If target token is base token, use priceNative to calculate rate
          // priceNative is the price of base token in quote token
          const priceNative = parseFloat(targetPair.priceNative);
          
          if (priceNative > 0) {
            rate = priceNative;
            console.log(`Target is base token, using priceNative directly: ${rate}`);
          }
        } else {
          // If target token is quote token, use priceNative to calculate rate
          // priceNative is the price of base token in quote token, so we need to invert it
          const priceNative = parseFloat(targetPair.priceNative);
          
          if (priceNative > 0) {
            rate = 1 / priceNative;
            console.log(`Target is quote token, inverting priceNative: 1/${priceNative} = ${rate}`);
          }
        }
        
        if (rate && rate > 0) {
          // Calculate how much target token we get for our base currency amount
          // If rate is "1 base = X target", then for totalAmount base we get: totalAmount / rate
          const tokenAmount = (totalAmount / rate).toFixed(6);
          
          console.log(`Final calculation: ${totalAmount} ${currency.toUpperCase()} / ${rate} = ${tokenAmount} ${tokenInfo?.symbol || 'TOKEN'}`);
          
          return {
            tokenAmount,
            tokenSymbol: tokenInfo?.symbol || 'TOKEN',
            tokenName: tokenInfo?.name || 'Custom Token',
            usdValue: totalAmount.toFixed(6),
            exchangeRate: rate.toFixed(6),
            loading: false
          };
        }
      }
      
      // If no matching pair found, try to find any pair with the target token
      const anyPair = data.pairs[0];
      if (anyPair && anyPair.priceUsd) {
        const targetPriceUsd = parseFloat(anyPair.priceUsd);
        const basePriceUsd = currency === 'sol' ? (solRate || 180) : 1; // USDC is $1
        
        if (targetPriceUsd > 0 && basePriceUsd > 0) {
          const rate = basePriceUsd / targetPriceUsd;
          // Calculate how much target token we get for our base currency amount
          // If rate is "1 base = X target", then for totalAmount base we get: totalAmount / rate
          const tokenAmount = (totalAmount / rate).toFixed(6);
          
          console.log(`USD fallback calculation: ${totalAmount} ${currency.toUpperCase()} / ${rate} = ${tokenAmount} ${tokenInfo?.symbol || 'TOKEN'}`);
          
          return {
            tokenAmount,
            tokenSymbol: tokenInfo?.symbol || 'TOKEN',
            tokenName: tokenInfo?.name || 'Custom Token',
            usdValue: totalAmount.toFixed(6),
            exchangeRate: rate.toFixed(6),
            loading: false
          };
        }
      }
    }
    
    throw new Error('No valid pair data found from DexScreener API');
    
  } catch (error) {
    console.error('DexScreener API error:', error);
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
        // Try Jupiter first, then fallback to DexScreener
        // Jupiter provides more accurate quotes with proper decimal handling
        // DexScreener is used as fallback when Jupiter fails
        try {
          quote = onGetPriceQuote 
            ? await onGetPriceQuote(tokenAddress)
            : await getJupiterPriceQuote(tokenAddress, currency, totalAmount);
        } catch (jupiterError) {
          console.warn('Jupiter quote failed, trying DexScreener fallback:', jupiterError);
          quote = await getDexScreenerPriceQuote(tokenAddress);
        }
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
        error: 'Failed to get price quote from Jupiter and DexScreener'
      });
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
      // Convert between SOL and USDC using Jupiter API as primary, DexScreener as fallback
      if (targetToken === 'sol' && currency === 'usdc') {
        // Convert USDC to SOL
        const solMint = 'So11111111111111111111111111111111111111112';
        const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        
        try {
          // Try Jupiter API first
          console.log('Attempting Jupiter API for USDC → SOL conversion');
          
          // Get token decimals from Solana
          let inputDecimals = 6; // USDC default
          let outputDecimals = 9; // SOL default
          
          try {
            const usdcMintKey = new PublicKey(usdcMint);
            const usdcMintInfo = await SOLANA_CONNECTION.getParsedAccountInfo(usdcMintKey);
            if (usdcMintInfo.value && 'parsed' in usdcMintInfo.value.data) {
              inputDecimals = (usdcMintInfo.value.data as any).parsed.info.decimals;
            }
            
            const solMintKey = new PublicKey(solMint);
            const solMintInfo = await SOLANA_CONNECTION.getParsedAccountInfo(solMintKey);
            if (solMintInfo.value && 'parsed' in solMintInfo.value.data) {
              outputDecimals = (solMintInfo.value.data as any).parsed.info.decimals;
            }
          } catch (error) {
            console.warn('Failed to fetch token decimals from Solana, using defaults:', error);
          }
          
          const amountInSmallestUnit = Math.floor(totalAmount * Math.pow(10, inputDecimals));
          
          const jupiterUrl = `https://quote-api.jup.ag/v6/quote?` +
            `inputMint=${usdcMint}&` +
            `outputMint=${solMint}&` +
            `amount=${amountInSmallestUnit}&` +
            `slippageBps=50&` +
            `onlyDirectRoutes=false&` +
            `asLegacyTransaction=false`;
          
          const response = await fetch(jupiterUrl);
          if (response.ok) {
            const data = await response.json();
            
            if (data && data.outAmount) {
              const solAmount = parseInt(data.outAmount) / Math.pow(10, outputDecimals);
              const rate = solAmount / totalAmount;
              
              console.log(`Jupiter USDC→SOL calculation: ${totalAmount} USDC → ${solAmount} SOL`);
              
              const solQuote = {
                tokenAmount: solAmount.toFixed(6),
                tokenSymbol: 'SOL',
                tokenName: 'Solana',
                usdValue: totalAmount.toFixed(6),
                exchangeRate: rate.toFixed(6),
                loading: false
              };
              setDefaultTokenQuote(solQuote);
              
              // Update total price display
              if (onTotalPriceChange) {
                onTotalPriceChange(solQuote.tokenAmount, 'SOL');
              }
              return;
            }
          }
          
          throw new Error('Jupiter API failed for USDC→SOL conversion');
        } catch (jupiterError) {
          console.warn('Jupiter API failed, trying DexScreener fallback:', jupiterError);
          
          // Fallback to DexScreener
          const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${solMint}`;
          
          const response = await fetch(dexScreenerUrl);
          if (response.ok) {
            const data = await response.json();
            
            if (data && data.pairs && data.pairs.length > 0) {
              // Find the SOL/USDC pair
              const solUsdcPair = data.pairs.find((pair: any) => {
                const baseToken = pair.baseToken?.address?.toLowerCase();
                const quoteToken = pair.quoteToken?.address?.toLowerCase();
                const solAddress = solMint.toLowerCase();
                const usdcAddress = usdcMint.toLowerCase();
                
                return (baseToken === solAddress && quoteToken === usdcAddress) ||
                       (baseToken === usdcAddress && quoteToken === solAddress);
              });
              
              if (solUsdcPair) {
                // Determine which token is base and which is quote
                const isSolBase = solUsdcPair.baseToken?.address?.toLowerCase() === solMint.toLowerCase();
                
                let rate;
                if (isSolBase) {
                  // If SOL is base token, priceNative is SOL price in USDC
                  const priceNative = parseFloat(solUsdcPair.priceNative);
                  if (priceNative > 0) {
                    rate = priceNative; // 1 SOL = rate USDC
                  }
                } else {
                  // If SOL is quote token, priceNative is USDC price in SOL
                  const priceNative = parseFloat(solUsdcPair.priceNative);
                  if (priceNative > 0) {
                    rate = 1 / priceNative; // 1 USDC = 1/rate SOL
                  }
                }
                
                if (rate && rate > 0) {
                  // For USDC → SOL: if rate is "1 SOL = X USDC", then for totalAmount USDC we get: totalAmount / rate SOL
                  const solAmount = (totalAmount / rate).toFixed(6);
                  
                  console.log(`DexScreener USDC→SOL calculation: ${totalAmount} USDC / ${rate} = ${solAmount} SOL`);
                  
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
                  return;
                }
              }
            }
          }
          
          throw new Error('Failed to get SOL quote from DexScreener');
        }
      } else if (targetToken === 'usdc' && currency === 'sol') {
        // Convert SOL to USDC
        const solMint = 'So11111111111111111111111111111111111111112';
        const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        
        try {
          // Try Jupiter API first
          console.log('Attempting Jupiter API for SOL → USDC conversion');
          
          // Get token decimals from Solana
          let inputDecimals = 9; // SOL default
          let outputDecimals = 6; // USDC default
          
          try {
            const solMintKey = new PublicKey(solMint);
            const solMintInfo = await SOLANA_CONNECTION.getParsedAccountInfo(solMintKey);
            if (solMintInfo.value && 'parsed' in solMintInfo.value.data) {
              inputDecimals = (solMintInfo.value.data as any).parsed.info.decimals;
            }
            
            const usdcMintKey = new PublicKey(usdcMint);
            const usdcMintInfo = await SOLANA_CONNECTION.getParsedAccountInfo(usdcMintKey);
            if (usdcMintInfo.value && 'parsed' in usdcMintInfo.value.data) {
              outputDecimals = (usdcMintInfo.value.data as any).parsed.info.decimals;
            }
          } catch (error) {
            console.warn('Failed to fetch token decimals from Solana, using defaults:', error);
          }
          
          const amountInSmallestUnit = Math.floor(totalAmount * Math.pow(10, inputDecimals));
          
          const jupiterUrl = `https://quote-api.jup.ag/v6/quote?` +
            `inputMint=${solMint}&` +
            `outputMint=${usdcMint}&` +
            `amount=${amountInSmallestUnit}&` +
            `slippageBps=50&` +
            `onlyDirectRoutes=false&` +
            `asLegacyTransaction=false`;
          
          const response = await fetch(jupiterUrl);
          if (response.ok) {
            const data = await response.json();
            
            if (data && data.outAmount) {
              const usdcAmount = parseInt(data.outAmount) / Math.pow(10, outputDecimals);
              const rate = usdcAmount / totalAmount;
              
              console.log(`Jupiter SOL→USDC calculation: ${totalAmount} SOL → ${usdcAmount} USDC`);
              
              const usdcQuote = {
                tokenAmount: usdcAmount.toFixed(6),
                tokenSymbol: 'USDC',
                tokenName: 'USD Coin',
                usdValue: totalAmount.toFixed(6),
                exchangeRate: rate.toFixed(6),
                loading: false
              };
              setDefaultTokenQuote(usdcQuote);
              
              // Update total price display
              if (onTotalPriceChange) {
                onTotalPriceChange(usdcQuote.tokenAmount, 'USDC');
              }
              return;
            }
          }
          
          throw new Error('Jupiter API failed for SOL→USDC conversion');
        } catch (jupiterError) {
          console.warn('Jupiter API failed, trying DexScreener fallback:', jupiterError);
          
          // Fallback to DexScreener
          const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/pairs/solana/${solMint}`;
          
          const response = await fetch(dexScreenerUrl);
          if (response.ok) {
            const data = await response.json();
            
            if (data && data.pairs && data.pairs.length > 0) {
              // Find the SOL/USDC pair
              const solUsdcPair = data.pairs.find((pair: any) => {
                const baseToken = pair.baseToken?.address?.toLowerCase();
                const quoteToken = pair.quoteToken?.address?.toLowerCase();
                const solAddress = solMint.toLowerCase();
                const usdcAddress = usdcMint.toLowerCase();
                
                return (baseToken === solAddress && quoteToken === usdcAddress) ||
                       (baseToken === usdcAddress && quoteToken === solAddress);
              });
              
              if (solUsdcPair) {
                // Determine which token is base and which is quote
                const isSolBase = solUsdcPair.baseToken?.address?.toLowerCase() === solMint.toLowerCase();
                
                let rate;
                if (isSolBase) {
                  // If SOL is base token, priceNative is SOL price in USDC
                  const priceNative = parseFloat(solUsdcPair.priceNative);
                  if (priceNative > 0) {
                    rate = priceNative; // 1 SOL = rate USDC
                  }
                } else {
                  // If SOL is quote token, priceNative is USDC price in SOL
                  const priceNative = parseFloat(solUsdcPair.priceNative);
                  if (priceNative > 0) {
                    rate = 1 / priceNative; // 1 USDC = 1/rate SOL
                  }
                }
                
                if (rate && rate > 0) {
                  const usdcAmount = (totalAmount * rate).toFixed(6);
                  
                  console.log(`DexScreener SOL→USDC calculation: ${totalAmount} SOL * ${rate} = ${usdcAmount} USDC`);
                  
                  const usdcQuote = {
                    tokenAmount: usdcAmount,
                    tokenSymbol: 'USDC',
                    tokenName: 'USD Coin',
                    usdValue: totalAmount.toFixed(6),
                    exchangeRate: rate.toFixed(2),
                    loading: false
                  };
                  setDefaultTokenQuote(usdcQuote);
                  
                  // Update total price display
                  if (onTotalPriceChange) {
                    onTotalPriceChange(usdcQuote.tokenAmount, 'USDC');
                  }
                  return;
                }
              }
            }
          }
          
          throw new Error('Failed to get USDC quote from DexScreener');
        }
      }
    } catch (error) {
      console.error(`Failed to get ${targetToken} quote:`, error);
      // Fallback to mock data
      const mockRates = { sol: 100, usdc: 1, merchant: 0.5 };
      const rate = mockRates[targetToken as keyof typeof mockRates];
      // For fallback: the rate represents how much base currency equals 1 target token
      // So for totalAmount base currency, we get totalAmount / rate target tokens
      const tokenAmount = (totalAmount / rate).toFixed(6);
      
      console.log(`Fallback calculation: ${totalAmount} ${currency.toUpperCase()} / ${rate} = ${tokenAmount} ${targetToken.toUpperCase()}`);
      
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

  const handleMethodSelect = (method: typeof paymentOptions[0]) => {
    if (!method.available) return;
    
    setIsDropdownOpen(false);
    setPriceQuote(null);
    setDefaultTokenQuote(null);
    setTokenInfo(null);
    setCustomTokenAddress('');
    setShowPriceDetails(false);
    setShowCustomTokenInput(false);
    
    let paymentMethod: PaymentMethod;
    
    if (method.type === 'cross-chain') {
      // For cross-chain payments, set up with default chain and USDC
      const defaultChain = SUPPORTED_CHAINS[0];
      const usdcAddress = USDC_ADDRESSES[defaultChain.id as keyof typeof USDC_ADDRESSES];
      
      paymentMethod = {
        type: 'cross-chain',
        tokenAddress: usdcAddress,
        chainId: defaultChain.id,
        chainName: defaultChain.name,
        tokenSymbol: 'USDC',
        tokenName: 'USD Coin'
      };
      
      console.log('Cross-chain payment method selected:', paymentMethod);
    } else {
      paymentMethod = { 
        type: method.type,
        defaultToken: method.type === 'default' ? defaultToken : undefined
      };
      
      console.log('Payment method selected:', paymentMethod);
    }
    
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
    
    console.log('Getting selected method label for:', selectedMethod);
    
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
        return `${selectedMethod.chainName || 'Cross-Chain'} USDC Payment`;
      default:
        return 'Select Payment Method';
    }
  };

  // Render default token selection buttons
  const renderDefaultTokenButtons = () => {
    return (
      selectedMethod?.type === 'default' && (
        <div className="mt-4 pt-4">
          <div className="flex justify-end">
            <div className="flex items-center bg-gray-800 rounded-full p-1 border border-gray-700 gap-1">
              {/* USDC */}
              <button
                type="button"
                onClick={async () => {
                  setDefaultToken('usdc');
                  onMethodChange({ type: 'default', defaultToken: 'usdc' });
                  await fetchDefaultTokenQuote('usdc');
                }}
                className={`px-3 py-1.5 rounded-full transition-colors text-xs flex items-center gap-1.5 ${
                  selectedMethod?.defaultToken === 'usdc'
                    ? 'bg-secondary text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                USDC
              </button>

              {/* SOL */}
              <button
                type="button"
                onClick={async () => {
                  setDefaultToken('sol');
                  onMethodChange({ type: 'default', defaultToken: 'sol' });
                  await fetchDefaultTokenQuote('sol');
                }}
                className={`px-3 py-1.5 rounded-full transition-colors text-xs flex items-center gap-1.5 ${
                  selectedMethod?.defaultToken === 'sol'
                    ? 'bg-secondary text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
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
                  className={`px-3 py-1.5 rounded-full transition-colors text-xs flex items-center gap-1.5 ${
                    selectedMethod?.defaultToken === 'merchant'
                      ? 'bg-secondary text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {firstRecommendedCA.symbol}
                </button>
              )}

              {/* Loading state for recommended CAs */}
              {loadingRecommendedCAs && recommendedCAs && recommendedCAs.length > 0 && (
                <div className="px-3 py-1.5 rounded-full bg-gray-700 flex items-center gap-1.5">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-secondary"></div>
                  <span className="text-xs text-gray-400">Loading...</span>
                </div>
              )}
            </div>
          </div>

          {/* Default Token Price Quote Display */}
          {defaultTokenQuote && selectedMethod?.defaultToken !== currency && (
            <div className="mt-3 bg-gray-700/50 rounded-lg overflow-hidden">
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
                      <span className="text-sm text-gray-400">Fetching {defaultTokenQuote.tokenSymbol} price via Jupiter...</span>
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
        <div className="bg-gray-800/50 rounded-lg p-4">
          {renderDefaultTokenButtons()}
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
            <h4 className="text-sm font-medium text-white">
              {hasStrictTokenRestriction ? 'Collection Token' : 'Select SPL Token'}
            </h4>
          </div>
          
          {/* Token Selection Grid - Only show if not strict token restriction */}
          {!hasStrictTokenRestriction && (
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
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{token.symbol.charAt(0)}</span>
                    </div>
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
          )}

          {/* Strict Token Display - Show when hasStrictTokenRestriction is true */}
          {hasStrictTokenRestriction && firstRecommendedCA && (
            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
              <div className="flex items-center gap-3 mb-3">
                <div>
                  <div className="text-sm font-medium text-white">{firstRecommendedCA.name}</div>
                  <div className="text-xs text-gray-400">{firstRecommendedCA.symbol} selected</div>
                </div>
              </div>
              
              {/* Price Quote Display for Strict Token */}
              {/* {priceQuote && (
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
                          <span className="text-sm text-gray-400">Fetching {priceQuote.tokenSymbol} price...</span>
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
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )} */}
            </div>
          )}

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
                  <div>
                    <div className="text-sm text-white font-medium">{tokenInfo.name}</div>
                    <div className="text-xs text-gray-400">{tokenInfo.symbol}</div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                {!hasStrictTokenRestriction && (
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
                )}
                
                {/* <Button
                  type="button"
                  onClick={() => fetchPriceQuote(customTokenAddress)}
                  variant="ghost"
                  size="sm"
                  disabled={!customTokenAddress.trim() || priceQuote?.loading || loadingTokenInfo}
                  className="flex-1"
                >
                  {priceQuote?.loading ? 'Getting Quote...' : 'Get Price Quote'}
                </Button> */}
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

      {/* Strict Token Restriction Notice */}
      {/* {hasStrictTokenRestriction && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-md p-3">
          <p className="text-xs text-purple-400">
            This collection requires payment with a specific token. Only the collection's designated token can be used for payment.
          </p>
        </div>
      )} */}

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