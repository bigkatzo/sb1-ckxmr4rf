// Types for API responses
interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: any;
  priceImpactPct: string;
  routePlan: any[];
}

interface DeBridgeQuoteResponse {
  estimation: {
    srcChainTokenIn: {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      amount: string;
    };
    srcChainTokenOut: {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      amount: string;
    };
    dstChainTokenOut: {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
      amount: string;
    };
    recommendedSlippage: number;
    costsDetails: any[];
  };
  tx: {
    allowanceTo: string;
    to: string;
    data: string;
    value: string;
    gasPrice: string;
    gasLimit: string;
  };
  fixFee: string;
  userPoints: number;
  integratorPoints: number;
}

interface PriceQuoteResult {
  tokenAmount: string;
  tokenSymbol: string;
  tokenName: string;
  usdValue: string;
  exchangeRate: string;
  loading: boolean;
  priceImpact?: string;
  route?: string;
  estimatedGas?: string;
  slippage?: string;
}

// Chain ID mappings for DeBridge
const DEBRIDGE_CHAIN_IDS: { [key: string]: number } = {
  'ethereum': 1,
  'bsc': 56,
  'polygon': 137,
  'avalanche': 43114,
  'fantom': 250,
  'arbitrum': 42161,
  'optimism': 10,
  'solana': 7565164,
  'base': 8453,
  'linea': 59144
};

// Popular token addresses for reference
const POPULAR_TOKENS = {
  // Solana
  SOL: 'So11111111111111111111111111111111111111112',
  USDC_SOL: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT_SOL: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  
  // Ethereum
  ETH: '0x0000000000000000000000000000000000000000',
  USDC_ETH: '0xA0b86a33E6441e68C5e60ED8D27A7c4C6c93F5A7',
  USDT_ETH: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
};

// Get token price from CoinGecko (for USD valuation)
const getTokenPriceUSD = async (tokenAddress: string, chainId?: string): Promise<number> => {
  try {
    // For demo purposes, return mock prices
    // In production, you'd call CoinGecko or another price API
    const mockPrices: { [key: string]: number } = {
      [POPULAR_TOKENS.SOL]: 95.50,
      [POPULAR_TOKENS.USDC_SOL]: 1.00,
      [POPULAR_TOKENS.USDT_SOL]: 1.00,
      [POPULAR_TOKENS.ETH]: 2850.00,
      [POPULAR_TOKENS.USDC_ETH]: 1.00,
      [POPULAR_TOKENS.USDT_ETH]: 1.00,
      [POPULAR_TOKENS.WETH]: 2850.00
    };
    
    return mockPrices[tokenAddress] || 1.00;
  } catch (error) {
    console.error('Error fetching token price:', error);
    return 1.00;
  }
};

// Jupiter API implementation (Solana DEX aggregator)
const getJupiterQuote = async (
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50 // 0.5% slippage
): Promise<JupiterQuoteResponse | null> => {
  try {
    const amountInSmallestUnit = Math.floor(amount * 1e6); // Assuming 6 decimals
    
    const url = `https://quote-api.jup.ag/v6/quote?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${amountInSmallestUnit}&` +
      `slippageBps=${slippageBps}&` +
      `onlyDirectRoutes=false&` +
      `asLegacyTransaction=false`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Jupiter quote error:', error);
    return null;
  }
};

// DeBridge API implementation (Cross-chain bridge aggregator)
const getDeBridgeQuote = async (
  srcChainId: number,
  dstChainId: number,
  srcChainTokenIn: string,
  srcChainTokenOut: string,
  amount: string,
  slippage: number = 5 // 5% slippage for cross-chain
): Promise<DeBridgeQuoteResponse | null> => {
  try {
    const url = 'https://api.dln.trade/v1.0/dln/order/quote';
    
    const requestBody = {
      srcChainId,
      dstChainId,
      srcChainTokenIn,
      srcChainTokenOut,
      amount,
      prependOperatingExpenses: false,
      affiliateFeePercent: 0,
      affiliateFeeRecipient: "0x0000000000000000000000000000000000000000"
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`DeBridge API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('DeBridge quote error:', error);
    return null;
  }
};

// Main implementation function
const handleGetPriceQuote = async (
  tokenAddress: string,
  chainId?: string,
  outputToken?: string,
  amount: number = 1,
  crossChain: boolean = false,
  targetChainId?: string
): Promise<PriceQuoteResult> => {
  console.log('Getting price quote for:', { 
    tokenAddress, 
    chainId, 
    outputToken, 
    amount, 
    crossChain, 
    targetChainId 
  });

  try {
    // Determine if this is a Solana transaction (Jupiter) or other chains (DeBridge)
    const isSolana = chainId === 'solana' || chainId === '7565164';
    
    if (isSolana && !crossChain) {
      // Use Jupiter for Solana-based swaps
      const outputMint = outputToken || POPULAR_TOKENS.USDC_SOL;
      const quote = await getJupiterQuote(tokenAddress, outputMint, amount);
      
      if (!quote) {
        throw new Error('Failed to get Jupiter quote');
      }

      // Parse the quote response
      const inputAmount = parseInt(quote.inAmount) / 1e6; // Assuming 6 decimals
      const outputAmount = parseInt(quote.outAmount) / 1e6;
      const exchangeRate = outputAmount / inputAmount;
      
      // Get USD price
      const tokenPriceUSD = await getTokenPriceUSD(tokenAddress);
      const usdValue = (inputAmount * tokenPriceUSD).toFixed(2);

      return {
        tokenAmount: inputAmount.toFixed(6),
        tokenSymbol: 'SOL', // You'd get this from token metadata
        tokenName: 'Solana',
        usdValue,
        exchangeRate: exchangeRate.toFixed(6),
        loading: false,
        priceImpact: quote.priceImpactPct,
        route: `Jupiter (${quote.routePlan.length} hop${quote.routePlan.length > 1 ? 's' : ''})`,
        slippage: `${quote.slippageBps / 100}%`
      };
      
    } else {
      // Use DeBridge for cross-chain or non-Solana swaps
      const srcChainIdNum = DEBRIDGE_CHAIN_IDS[chainId || 'ethereum'] || 1;
      const dstChainIdNum = targetChainId ? 
        DEBRIDGE_CHAIN_IDS[targetChainId] : srcChainIdNum;
      
      const outputTokenAddress = outputToken || 
        (chainId === 'ethereum' ? POPULAR_TOKENS.USDC_ETH : POPULAR_TOKENS.USDC_SOL);
      
      const amountWei = (amount * 1e18).toString(); // Assuming 18 decimals
      
      const quote = await getDeBridgeQuote(
        srcChainIdNum,
        dstChainIdNum,
        tokenAddress,
        outputTokenAddress,
        amountWei
      );
      
      if (!quote) {
        throw new Error('Failed to get DeBridge quote');
      }

      // Parse DeBridge response
      const inputAmount = parseFloat(quote.estimation.srcChainTokenIn.amount) / 
        Math.pow(10, quote.estimation.srcChainTokenIn.decimals);
      const outputAmount = parseFloat(quote.estimation.dstChainTokenOut.amount) / 
        Math.pow(10, quote.estimation.dstChainTokenOut.decimals);
      const exchangeRate = outputAmount / inputAmount;
      
      // Get USD price
      const tokenPriceUSD = await getTokenPriceUSD(tokenAddress);
      const usdValue = (inputAmount * tokenPriceUSD).toFixed(2);

      return {
        tokenAmount: inputAmount.toFixed(6),
        tokenSymbol: quote.estimation.srcChainTokenIn.symbol,
        tokenName: quote.estimation.srcChainTokenIn.name,
        usdValue,
        exchangeRate: exchangeRate.toFixed(6),
        loading: false,
        route: crossChain ? 
          `DeBridge Cross-chain (${chainId} → ${targetChainId})` : 
          'DeBridge',
        slippage: `${quote.estimation.recommendedSlippage}%`,
        estimatedGas: (parseInt(quote.tx.gasLimit) * parseInt(quote.tx.gasPrice) / 1e18).toFixed(6)
      };
    }
    
  } catch (error) {
    console.error('Price quote error:', error);
    
    // Return fallback data
    const tokenPriceUSD = await getTokenPriceUSD(tokenAddress);
    return {
      tokenAmount: amount.toFixed(6),
      tokenSymbol: 'TOKEN',
      tokenName: 'Unknown Token',
      usdValue: (amount * tokenPriceUSD).toFixed(2),
      exchangeRate: '1.000000',
      loading: false
    };
  }
};

// Utility function to get supported tokens for a chain
const getSupportedTokens = (chainId: string) => {
  switch (chainId) {
    case 'solana':
      return {
        SOL: POPULAR_TOKENS.SOL,
        USDC: POPULAR_TOKENS.USDC_SOL,
        USDT: POPULAR_TOKENS.USDT_SOL
      };
    case 'ethereum':
      return {
        ETH: POPULAR_TOKENS.ETH,
        USDC: POPULAR_TOKENS.USDC_ETH,
        USDT: POPULAR_TOKENS.USDT_ETH,
        WETH: POPULAR_TOKENS.WETH
      };
    default:
      return {};
  }
};

// Export the main function and utilities
export {
  handleGetPriceQuote,
  getSupportedTokens,
  POPULAR_TOKENS,
  DEBRIDGE_CHAIN_IDS,
  type PriceQuoteResult
};