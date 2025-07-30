import {getSolanaPrice} from './price-conversion'


/**
 * Format a price with currency conversion.
 * @param price Price in base currency (basePrice).
 * @param paymentMethodType Target currency for display ('SOL' or 'USDC').
 * @param basePrice The currency the price is currently in ('SOL' or 'USDC').
 * @returns Formatted price as string in the target payment method.
 */
export async function formatPrice(
  price: number,
  paymentMethodType: string = 'SOL',
  basePrice: string = 'SOL',
  rate: number | null = null  // Optional conversion
): Promise<string> {
  let convertedPrice = price;

  if (basePrice.toUpperCase() !== paymentMethodType.toUpperCase()) {
      const solRate = rate ?? (await getSolanaPrice()); // USD value of 1 SOL
    if (basePrice.toUpperCase() === 'SOL' && paymentMethodType.toUpperCase() === 'USDC') {
      convertedPrice = price * solRate;
    } else if (basePrice.toUpperCase() === 'USDC' && paymentMethodType.toUpperCase() === 'SOL') {
      convertedPrice = price / solRate;
    }
  }

  const formattedValue = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(convertedPrice);

  console.log(`Formatted price: ${formattedValue} ${paymentMethodType.toUpperCase()}`);

  return `${formattedValue} ${paymentMethodType.toUpperCase()}`;
}

export function formatPriceWithRate(
  price: number,
  paymentMethodType: string = 'SOL',
  basePrice: string = 'SOL',
  rate: number  // Optional conversion
): string {
  let convertedPrice = price;

  if (basePrice.toUpperCase() !== paymentMethodType.toUpperCase()) {
      const solRate = rate; // USD value of 1 SOL
    if (basePrice.toUpperCase() === 'SOL' && paymentMethodType.toUpperCase() === 'USDC') {
      convertedPrice = price * solRate;
    } else if (basePrice.toUpperCase() === 'USDC' && paymentMethodType.toUpperCase() === 'SOL') {
      convertedPrice = price / solRate;
    }
  }

  const formattedValue = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(convertedPrice);

  console.log(`Formatted price: ${formattedValue} ${paymentMethodType.toUpperCase()}`);

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