/**
 * Format a price as SOL
 * @param price Price in SOL
 * @returns Formatted price as string
 */
export function formatPrice(price: number, paymentMethodType = 'USDC', basePrice = 'sol'): string {
  // Format as number with up to 4 decimal places
  // if basePrice is sol and paymentMethod is sol ... return format
  // if basePrice is sol and method is usdc... convert to usdc with format/rate
  // if basePrice is usdc and method is sol... 
  const formattedValue = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(price);
  
  // Add SOL suffix
  return `${formattedValue} ${paymentMethodType.toUpperCase()}`;
}

/**
 * Format a price as USD (for legacy support)
 * @param price Price in cents
 * @returns Formatted price as string
 */
export function formatUsdPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price / 100);
} 