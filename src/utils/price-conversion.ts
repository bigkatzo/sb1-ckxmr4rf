import { useEffect, useState } from 'react';

export async function getSolanaPrice(): Promise<number> {
  try {
    console.log('Fetching Solana price from server...');
    const response = await fetch('/api/get-solana-price');
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Price data:', data);
    
    if (data.success && typeof data.price === 'number') {
      return data.price;
    } else if (data.fallbackPrice) {
      console.warn('Using fallback price due to API error:', data.error);
      return data.fallbackPrice;
    } else {
      throw new Error(data.error || 'Invalid response format');
    }
  } catch (error) {
    console.error('Error fetching Solana price:', error);
    return 180; // Fallback price
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