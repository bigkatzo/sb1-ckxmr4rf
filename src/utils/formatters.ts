import { getSolanaPrice } from './price-conversion';
import { convertCurrency, roundUpForDisplay } from './currencyUtils';

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
      convertedPrice = convertCurrency(price, basePrice, paymentMethodType, solRate);
    } else if (basePrice.toUpperCase() === 'USDC' && paymentMethodType.toUpperCase() === 'SOL') {
      convertedPrice = convertCurrency(price, basePrice, paymentMethodType, solRate);
    }
  }

  // Round up for display
  const displayPrice = roundUpForDisplay(convertedPrice, paymentMethodType);

  // Format with appropriate decimal places
  const currencyUpper = paymentMethodType.toUpperCase();
  let formattedValue: string;
  
  if (currencyUpper === 'SOL') {
    // For SOL, show up to 2 decimal places (since we're rounding up to whole units)
    formattedValue = displayPrice.toFixed(2).replace(/\.?0+$/, '');
  } else {
    // For USD/USDC, show up to 2 decimal places
    formattedValue = displayPrice.toFixed(2).replace(/\.?0+$/, '');
  }

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
      convertedPrice = convertCurrency(price, basePrice, paymentMethodType, solRate);
    } else if (basePrice.toUpperCase() === 'USDC' && paymentMethodType.toUpperCase() === 'SOL') {
      convertedPrice = convertCurrency(price, basePrice, paymentMethodType, solRate);
    }
  }

  // Round up for display
  const displayPrice = roundUpForDisplay(convertedPrice, paymentMethodType);

  // Format with appropriate decimal places
  const currencyUpper = paymentMethodType.toUpperCase();
  let formattedValue: string;
  
  if (currencyUpper === 'SOL') {
    // For SOL, show up to 2 decimal places (since we're rounding up to whole units)
    formattedValue = displayPrice.toFixed(2).replace(/\.?0+$/, '');
  } else {
    // For USD/USDC, show up to 2 decimal places
    formattedValue = displayPrice.toFixed(2).replace(/\.?0+$/, '');
  }

  console.log(`Formatted price: ${formattedValue} ${paymentMethodType.toUpperCase()}`);

  return `${formattedValue} ${paymentMethodType.toUpperCase()}`;
}

/**
 * Format a price with token icon - returns an object with formatted text and icon info
 * @param price Price in base currency
 * @param paymentMethodType Target currency for display
 * @param basePrice The currency the price is currently in
 * @param rate Conversion rate
 * @returns Object with formatted text and token symbol for icon display
 */
export function formatPriceWithIcon(
  price: number,
  paymentMethodType: string = 'SOL',
  basePrice: string = 'SOL',
  rate: number
): { text: string; symbol: string; amount: number } {
  let convertedPrice = price;

  if (basePrice.toUpperCase() !== paymentMethodType.toUpperCase()) {
    if (basePrice.toUpperCase() === 'SOL' && paymentMethodType.toUpperCase() === 'USDC') {
      convertedPrice = convertCurrency(price, basePrice, paymentMethodType, rate);
    } else if (basePrice.toUpperCase() === 'USDC' && paymentMethodType.toUpperCase() === 'SOL') {
      convertedPrice = convertCurrency(price, basePrice, paymentMethodType, rate);
    }
  }

  // Round up for display
  const displayPrice = roundUpForDisplay(convertedPrice, paymentMethodType);

  // Format with appropriate decimal places
  const currencyUpper = paymentMethodType.toUpperCase();
  let formattedValue: string;
  
  if (currencyUpper === 'SOL') {
    // For SOL, show up to 2 decimal places (since we're rounding up to whole units)
    formattedValue = displayPrice.toFixed(2).replace(/\.?0+$/, '');
  } else {
    // For USD/USDC, show up to 2 decimal places
    formattedValue = displayPrice.toFixed(2).replace(/\.?0+$/, '');
  }

  return {
    text: `${formattedValue} ${paymentMethodType.toUpperCase()}`,
    symbol: paymentMethodType.toUpperCase(),
    amount: displayPrice
  };
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