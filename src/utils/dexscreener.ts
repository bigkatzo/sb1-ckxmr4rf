/**
 * DexScreener API utilities for token price conversions
 * Provides accurate real-time rates for SOL/USDC and other token pairs
 */

// DexScreener API base URL
const DEXSCREENER_API_BASE = 'https://api.dexscreener.com/latest/dex';

// Known token addresses
const TOKEN_ADDRESSES = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
};

// Cache for rates to avoid excessive API calls
const rateCache = new Map<string, { rate: number; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Get the DexScreener rate for a token pair
 * @param baseTokenAddress - The base token address (e.g., SOL mint address)
 * @param quoteTokenAddress - The quote token address (e.g., USDC mint address)
 * @returns The conversion rate (how much quote token per 1 base token)
 */
export async function getDexScreenerRate(
  baseTokenAddress: string,
  quoteTokenAddress: string
): Promise<number> {
  const cacheKey = `${baseTokenAddress}-${quoteTokenAddress}`;
  const now = Date.now();
  
  // Check cache first
  const cached = rateCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    console.log(`Using cached DexScreener rate for ${cacheKey}: ${cached.rate}`);
    return cached.rate;
  }

  try {
    console.log(`Fetching DexScreener rate for ${baseTokenAddress} to ${quoteTokenAddress}`);
    
    const response = await fetch(
      `${DEXSCREENER_API_BASE}/tokens/${baseTokenAddress}`
    );
    
    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      throw new Error('No trading pairs found for token');
    }
    
    // Find the pair with the quote token
    const targetPair = data.pairs.find((pair: any) => 
      pair.baseToken?.address?.toLowerCase() === baseTokenAddress.toLowerCase() &&
      pair.quoteToken?.address?.toLowerCase() === quoteTokenAddress.toLowerCase()
    );
    
    if (!targetPair) {
      throw new Error(`No trading pair found for ${baseTokenAddress} to ${quoteTokenAddress}`);
    }
    
    // Get the price from the pair data
    const rate = parseFloat(targetPair.priceUsd || targetPair.priceNative);
    
    if (!rate || isNaN(rate) || rate <= 0) {
      throw new Error('Invalid rate received from DexScreener');
    }
    
    console.log(`DexScreener rate for ${cacheKey}: ${rate}`);
    
    // Cache the result
    rateCache.set(cacheKey, { rate, timestamp: now });
    
    return rate;
    
  } catch (error) {
    console.error('Error fetching DexScreener rate:', error);
    
    // Return fallback rates for common pairs
    if (baseTokenAddress === TOKEN_ADDRESSES.SOL && quoteTokenAddress === TOKEN_ADDRESSES.USDC) {
      console.warn('Using fallback SOL/USDC rate: 180');
      return 180;
    }
    if (baseTokenAddress === TOKEN_ADDRESSES.USDC && quoteTokenAddress === TOKEN_ADDRESSES.SOL) {
      console.warn('Using fallback USDC/SOL rate: 0.005556');
      return 0.005556;
    }
    
    throw error;
  }
}

/**
 * Get SOL to USDC conversion rate
 * @returns The rate (how much USDC per 1 SOL)
 */
export async function getSolToUsdcRate(): Promise<number> {
  return getDexScreenerRate(TOKEN_ADDRESSES.SOL, TOKEN_ADDRESSES.USDC);
}

/**
 * Get USDC to SOL conversion rate
 * @returns The rate (how much SOL per 1 USDC)
 */
export async function getUsdcToSolRate(): Promise<number> {
  return getDexScreenerRate(TOKEN_ADDRESSES.USDC, TOKEN_ADDRESSES.SOL);
}

/**
 * Convert SOL amount to USDC using DexScreener rate
 * @param solAmount - Amount in SOL
 * @returns Amount in USDC
 */
export async function convertSolToUsdc(solAmount: number): Promise<number> {
  const rate = await getSolToUsdcRate();
  return solAmount * rate;
}

/**
 * Convert USDC amount to SOL using DexScreener rate
 * @param usdcAmount - Amount in USDC
 * @returns Amount in SOL
 */
export async function convertUsdcToSol(usdcAmount: number): Promise<number> {
  const rate = await getUsdcToSolRate();
  return usdcAmount * rate;
}

/**
 * Get conversion rate for any token pair
 * @param baseToken - Base token symbol or address
 * @param quoteToken - Quote token symbol or address
 * @returns The conversion rate
 */
export async function getTokenConversionRate(
  baseToken: string,
  quoteToken: string
): Promise<number> {
  // Handle common token symbols
  const baseAddress = baseToken.toUpperCase() === 'SOL' ? TOKEN_ADDRESSES.SOL :
                     baseToken.toUpperCase() === 'USDC' ? TOKEN_ADDRESSES.USDC :
                     baseToken.toUpperCase() === 'USDT' ? TOKEN_ADDRESSES.USDT :
                     baseToken;
  
  const quoteAddress = quoteToken.toUpperCase() === 'SOL' ? TOKEN_ADDRESSES.SOL :
                      quoteToken.toUpperCase() === 'USDC' ? TOKEN_ADDRESSES.USDC :
                      quoteToken.toUpperCase() === 'USDT' ? TOKEN_ADDRESSES.USDT :
                      quoteToken;
  
  return getDexScreenerRate(baseAddress, quoteAddress);
}

/**
 * Clear the rate cache (useful for testing or forcing fresh rates)
 */
export function clearRateCache(): void {
  rateCache.clear();
  console.log('DexScreener rate cache cleared');
} 