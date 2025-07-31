import { useEffect, useState } from 'react';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export async function getSolanaPrice(): Promise<number> {
  try {
    console.log('Fetching Solana price from Coingecko...');
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=solana&vs_currencies=usd`
    );
    const data = await response.json();
    console.log(data);
    return data.solana.usd;
  } catch (error) {
    console.error('Error fetching Solana price:', error);
    return 180;
  }
}

export function convertSolToUsd(solAmount: number, solPrice: number): number {
  return solAmount * solPrice;
}

// React hook for real-time SOL/USD price
export function useSolanaPrice(refreshInterval = 60000) { // Default 1 minute refresh
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const solPrice = await getSolanaPrice();
        setPrice(solPrice);
        setError(null);
      } catch (err) {
        setError('Failed to fetch SOL price');
        console.error('Error in useSolanaPrice:', err);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchPrice();

    // Set up polling
    const interval = setInterval(fetchPrice, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { price, error, loading };
} 