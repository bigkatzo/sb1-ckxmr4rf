import { useEffect, useState, useCallback } from 'react';
import { getSolToUsdcRate, getUsdcToSolRate, convertTokenAmount } from '../services/token-price-discovery';

// Fallback to CoinGecko for initial loading or as backup
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

interface TokenPrices {
  SOL: {
    usd: number;
  };
  USDC: {
    usd: number;
  };
}

export interface TokenPriceData {
  prices: TokenPrices | null;
  loading: boolean;
  error: string | null;
  convertSolToUsdc: (solAmount: number) => number;
  convertUsdcToSol: (usdcAmount: number) => number;
  convertToken: (amount: number, fromToken: string, toToken: string) => Promise<number>;
}

/**
 * Hook for fetching and using token prices with on-chain data
 */
export function useTokenPrices(refreshInterval = 60000): TokenPriceData {
  const [prices, setPrices] = useState<TokenPrices | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solToUsdcRate, setSolToUsdcRate] = useState<number | null>(null);
  const [usdcToSolRate, setUsdcToSolRate] = useState<number | null>(null);

  // Fetch token prices using on-chain data
  useEffect(() => {
    const fetchOnChainPrices = async () => {
      try {
        setLoading(true);
        
        // Get on-chain rates
        const [solUsdcRate, usdcSolRate] = await Promise.all([
          getSolToUsdcRate(),
          getUsdcToSolRate()
        ]);
        
        // Calculate USD prices based on USDC being approximately $1
        const solUsdPrice = solUsdcRate; // 1 SOL = X USDC ≈ X USD
        
        // Set rates
        setSolToUsdcRate(solUsdcRate);
        setUsdcToSolRate(usdcSolRate);
        
        // Update prices
        setPrices({
          SOL: {
            usd: solUsdPrice
          },
          USDC: {
            usd: 1 // USDC is pegged to USD
          }
        });
        
        setError(null);
      } catch (err) {
        console.error('Error fetching on-chain token prices:', err);
        
        // Fallback to CoinGecko
        try {
          const response = await fetch(
            `${COINGECKO_API}/simple/price?ids=solana,usd-coin&vs_currencies=usd`
          );
          
          if (!response.ok) {
            throw new Error('Failed to fetch token prices');
          }
          
          const data = await response.json();
          
          const prices = {
            SOL: {
              usd: data.solana?.usd || 0,
            },
            USDC: {
              usd: data['usd-coin']?.usd || 1, // USDC should be ~1 USD
            },
          };
          
          // Set prices and calculate rates
          setPrices(prices);
          setSolToUsdcRate(prices.SOL.usd / prices.USDC.usd);
          setUsdcToSolRate(prices.USDC.usd / prices.SOL.usd);
          
          // Log that we're using fallback
          console.warn('Using CoinGecko fallback for token prices');
        } catch (fallbackErr) {
          setError('Failed to fetch token prices');
          console.error('Fallback price fetch also failed:', fallbackErr);
        }
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchOnChainPrices();
    
    // Set up polling interval
    const interval = setInterval(fetchOnChainPrices, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Convert SOL to USDC using on-chain rate
  const convertSolToUsdc = useCallback((solAmount: number): number => {
    if (solToUsdcRate === null) {
      // Fallback to price-based calculation if rate is not available
      if (!prices) return 0;
      const solUsdPrice = prices.SOL.usd;
      const usdcUsdPrice = prices.USDC.usd;
      if (usdcUsdPrice <= 0) return 0;
      return (solAmount * solUsdPrice) / usdcUsdPrice;
    }
    
    // Use on-chain rate
    return solAmount * solToUsdcRate;
  }, [solToUsdcRate, prices]);

  // Convert USDC to SOL using on-chain rate
  const convertUsdcToSol = useCallback((usdcAmount: number): number => {
    if (usdcToSolRate === null) {
      // Fallback to price-based calculation if rate is not available
      if (!prices) return 0;
      const solUsdPrice = prices.SOL.usd;
      if (solUsdPrice <= 0) return 0;
      return usdcAmount / solUsdPrice;
    }
    
    // Use on-chain rate
    return usdcAmount * usdcToSolRate;
  }, [usdcToSolRate, prices]);
  
  // General token conversion function for any supported tokens
  const convertToken = useCallback(async (
    amount: number,
    fromToken: string,
    toToken: string
  ): Promise<number> => {
    // Handle the common cases with cached rates
    if (fromToken === 'SOL' && toToken === 'USDC') {
      return convertSolToUsdc(amount);
    } else if (fromToken === 'USDC' && toToken === 'SOL') {
      return convertUsdcToSol(amount);
    }
    
    // For other token pairs, use the on-chain conversion
    try {
      return await convertTokenAmount(amount, fromToken, toToken);
    } catch (error) {
      console.error(`Error converting ${fromToken} to ${toToken}:`, error);
      return 0;
    }
  }, [convertSolToUsdc, convertUsdcToSol]);

  return {
    prices,
    loading,
    error,
    convertSolToUsdc,
    convertUsdcToSol,
    convertToken
  };
} 