/**
 * Format a price based on token type
 * @param price The price to format
 * @param token The token type (SOL, USDC, etc.)
 * @param options Additional formatting options
 * @returns Formatted price string
 */
export function formatTokenPrice(
  price: number, 
  token: string = 'SOL',
  options: {
    showSymbol?: boolean,
    minimumFractionDigits?: number,
    maximumFractionDigits?: number
  } = {}
): string {
  const { 
    showSymbol = false, 
    minimumFractionDigits,
    maximumFractionDigits 
  } = options;
  
  // Use token-specific decimal precision
  const defaultMaxFractionDigits = token === 'USDC' ? 2 : 8;
  
  // Format the number
  const formattedPrice = price.toLocaleString('en-US', {
    minimumFractionDigits: minimumFractionDigits ?? 0,
    maximumFractionDigits: maximumFractionDigits ?? defaultMaxFractionDigits
  });
  
  // Add token symbol if requested
  return showSymbol ? `${formattedPrice} ${token}` : formattedPrice;
}

/**
 * Calculate the difference between two prices and format as a change string
 * @param newPrice New price
 * @param basePrice Base price to compare against
 * @param token Token type for formatting
 * @returns Formatted price difference with +/- sign
 */
export function formatPriceDifference(
  newPrice: number,
  basePrice: number,
  token: string = 'SOL'
): string {
  const difference = newPrice - basePrice;
  if (difference === 0) return '';
  
  const sign = difference > 0 ? '+' : '';
  return `${sign}${formatTokenPrice(difference, token, { showSymbol: true })}`;
} 