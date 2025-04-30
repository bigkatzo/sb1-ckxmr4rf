import { SUPPORTED_TOKENS } from './token-payments';

// Native SOL mint address
const SOL_MINT = 'So11111111111111111111111111111111111111112';
// USDC mint address
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/**
 * Cache token prices for a short period to avoid excessive API calls
 */
const priceCache: {
  [key: string]: {
    price: number;
    timestamp: number;
  }
} = {};

// Cache TTL in milliseconds (15 seconds)
const CACHE_TTL = 15 * 1000;

/**
 * Get on-chain conversion rate between two tokens using Jupiter API
 * @param fromMint Source token mint address
 * @param toMint Destination token mint address
 * @param amount Amount in source token (in smallest units)
 * @returns Conversion rate (1 fromToken = X toTokens)
 */
export async function getOnChainConversionRate(
  fromMint: string,
  toMint: string,
  amount: number = 1_000_000 // Default to 1 USDC equivalent for better precision
): Promise<number> {
  // Create cache key
  const cacheKey = `${fromMint}:${toMint}:${amount}`;
  
  // Check cache
  const cached = priceCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }
  
  try {
    // Use Jupiter API directly
    const jupiterApi = 'https://quote-api.jup.ag/v6';
    const quoteEndpoint = `${jupiterApi}/quote`;
    
    // Build the URL with query parameters
    const queryParams = new URLSearchParams({
      inputMint: fromMint,
      outputMint: toMint,
      amount: amount.toString(),
      slippageBps: '1', // 0.01% slippage for quotes
    });
    
    // Make the request
    const response = await fetch(`${quoteEndpoint}?${queryParams}`);
    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.status} ${response.statusText}`);
    }
    
    const quoteData = await response.json();
    
    if (!quoteData || !quoteData.outAmount) {
      throw new Error(`No routes found for ${fromMint} to ${toMint}`);
    }
    
    // Calculate rate
    const outAmount = parseInt(quoteData.outAmount);
    const rate = outAmount / amount;
    
    // Cache the result
    priceCache[cacheKey] = {
      price: rate,
      timestamp: Date.now()
    };
    
    return rate;
  } catch (error) {
    console.error('Error getting on-chain conversion rate:', error);
    throw error;
  }
}

/**
 * Converts an amount from one token to another using on-chain data
 */
export async function convertTokenAmount(
  amount: number,
  fromToken: string,
  toToken: string
): Promise<number> {
  if (fromToken === toToken) {
    return amount;
  }
  
  // Get mint addresses
  const fromMint = fromToken === 'SOL' ? SOL_MINT : SUPPORTED_TOKENS[fromToken]?.tokenMint;
  const toMint = toToken === 'SOL' ? SOL_MINT : SUPPORTED_TOKENS[toToken]?.tokenMint;
  
  if (!fromMint || !toMint) {
    throw new Error(`Unsupported token conversion: ${fromToken} to ${toToken}`);
  }
  
  // Get token decimals 
  const fromDecimals = SUPPORTED_TOKENS[fromToken]?.decimals || 9;
  const toDecimals = SUPPORTED_TOKENS[toToken]?.decimals || 9;
  
  // Convert to smallest units for accurate pricing
  const amountInSmallestUnits = amount * Math.pow(10, fromDecimals);
  
  // Get on-chain rate
  const rate = await getOnChainConversionRate(fromMint, toMint, amountInSmallestUnits);
  
  // Calculate output amount and convert back to standard units
  const outputAmount = (amountInSmallestUnits * rate) / Math.pow(10, toDecimals);
  
  return outputAmount;
}

/**
 * Get SOL/USDC conversion rate from on-chain data
 */
export async function getSolToUsdcRate(): Promise<number> {
  const solMint = SOL_MINT;
  const usdcMint = USDC_MINT;
  
  // Use 1 SOL (in lamports) for the quote
  const lamports = 1_000_000_000; // 1 SOL in lamports
  
  const rate = await getOnChainConversionRate(solMint, usdcMint, lamports);
  
  // Convert rate to be expressed as "1 SOL = X USDC"
  // Since the input is 1 SOL, the rate already represents this
  return rate;
}

/**
 * Get USDC/SOL conversion rate from on-chain data
 */
export async function getUsdcToSolRate(): Promise<number> {
  const usdcMint = USDC_MINT;
  const solMint = SOL_MINT;
  
  // Use 1 USDC (in smallest units) for the quote
  const usdcAmount = 1_000_000; // 1 USDC in smallest units
  
  const rate = await getOnChainConversionRate(usdcMint, solMint, usdcAmount);
  
  // Convert rate to be expressed as "1 USDC = X SOL"
  // Since the input is 1 USDC, the rate already represents this
  return rate;
} 