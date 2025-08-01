/**
 * Currency utility functions for precise calculations
 * Uses integer arithmetic to avoid floating-point precision loss
 */

// Convert a price to the smallest currency unit (cents for USD, lamports for SOL, etc.)
export const toSmallestUnit = (price: number, currency: string): number => {
  const currencyUpper = currency.toUpperCase();
  
  // For USD/USDC, use cents (2 decimal places)
  if (currencyUpper === 'USD' || currencyUpper === 'USDC') {
    return Math.round(price * 100);
  }
  
  // For SOL, use lamports (9 decimal places)
  if (currencyUpper === 'SOL') {
    return Math.round(price * 1e9);
  }
  
  // Default to 2 decimal places for other currencies
  return Math.round(price * 100);
};

// Convert from smallest currency unit back to display format
export const fromSmallestUnit = (smallestUnit: number, currency: string): number => {
  const currencyUpper = currency.toUpperCase();
  
  // For USD/USDC, convert from cents
  if (currencyUpper === 'USD' || currencyUpper === 'USDC') {
    return smallestUnit / 100;
  }
  
  // For SOL, convert from lamports
  if (currencyUpper === 'SOL') {
    return smallestUnit / 1e9;
  }
  
  // Default to 2 decimal places for other currencies
  return smallestUnit / 100;
};

// Convert price from one currency to another using precise arithmetic (no rounding)
export const convertCurrency = (
  price: number, 
  fromCurrency: string, 
  toCurrency: string, 
  solRate: number
): number => {
  const fromUpper = fromCurrency.toUpperCase();
  const toUpper = toCurrency.toUpperCase();
  
  // If currencies are the same, no conversion needed
  if (fromUpper === toUpper) {
    return price;
  }
  
  // Convert to smallest units for precise calculation
  const priceInSmallestUnit = toSmallestUnit(price, fromCurrency);
  
  let convertedSmallestUnit: number;
  
  if (fromUpper === 'SOL' && toUpper === 'USDC') {
    // SOL → USDC: multiply by solRate
    convertedSmallestUnit = Math.round(priceInSmallestUnit * solRate * 100 / 1e9);
  } else if (fromUpper === 'USDC' && toUpper === 'SOL') {
    // USDC → SOL: divide by solRate
    convertedSmallestUnit = Math.round(priceInSmallestUnit * 1e9 / (solRate * 100));
  } else {
    // For other conversions, use the same logic as before but with precise arithmetic
    if (fromUpper === 'SOL' && toUpper === 'USD') {
      convertedSmallestUnit = Math.round(priceInSmallestUnit * solRate * 100 / 1e9);
    } else if (fromUpper === 'USD' && toUpper === 'SOL') {
      convertedSmallestUnit = Math.round(priceInSmallestUnit * 1e9 / (solRate * 100));
    } else {
      // Default case - assume same conversion as SOL/USDC
      convertedSmallestUnit = priceInSmallestUnit;
    }
  }
  
  // Convert back to display format (no rounding - keep precise value)
  return fromSmallestUnit(convertedSmallestUnit, toCurrency);
};

// Calculate total price with precise arithmetic (no rounding)
export const calculateTotalPrice = (
  items: Array<{
    priceInfo?: { modifiedPrice: number };
    product: { price: number; baseCurrency?: string };
    quantity: number;
  }>,
  targetCurrency: string,
  solRate: number
): number => {
  // Convert all prices to smallest units in target currency and sum them
  const totalInSmallestUnit = items.reduce((total, item) => {
    const itemPrice = item.priceInfo?.modifiedPrice || item.product.price;
    const baseCurrency = item.product.baseCurrency?.toUpperCase() || 'SOL';
    
    // Convert item price to target currency using precise arithmetic
    const convertedPrice = convertCurrency(itemPrice, baseCurrency, targetCurrency, solRate);
    
    // Convert to smallest unit and multiply by quantity
    const itemTotalInSmallestUnit = toSmallestUnit(convertedPrice, targetCurrency) * item.quantity;
    
    return total + itemTotalInSmallestUnit;
  }, 0);
  
  // Convert back to display format (no rounding - keep precise value)
  return fromSmallestUnit(totalInSmallestUnit, targetCurrency);
};

// Round up for display purposes (user-facing values)
export const roundUpForDisplay = (value: number, currency: string): number => {
  const currencyUpper = currency.toUpperCase();
  
  if (currencyUpper === 'SOL') {
    // For SOL, round up to the next 0.01 increment
    return Math.ceil(value * 100) / 100;
  } else if (currencyUpper === 'USD' || currencyUpper === 'USDC') {
    // Round up to 2 decimal places for USD/USDC
    return Math.ceil(value * 100) / 100;
  }
  
  // Default: round up to 2 decimal places
  return Math.ceil(value * 100) / 100;
}; 