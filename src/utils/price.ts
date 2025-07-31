interface CalculateModifiedPriceParams {
  basePrice: number;
  currentOrders: number;
  minOrders: number;
  maxStock: number | null;
  modifierBefore: number | null;
  modifierAfter: number | null;
}

/**
 * Calculates the modified price based on current orders and modifiers
 * 
 * @param params Price calculation parameters
 * @returns The modified price with 2 decimal places precision, always rounded up
 */
export function calculateModifiedPrice(params: CalculateModifiedPriceParams): number {
  const { 
    basePrice, 
    currentOrders, 
    minOrders, 
    maxStock, 
    modifierBefore, 
    modifierAfter 
  } = params;

  // If no modifiers set, return base price
  if (!modifierBefore && !modifierAfter) {
    return Math.ceil(basePrice * 100) / 100;
  }

  // Before minimum orders
  if (currentOrders < minOrders) {
    if (!modifierBefore) return Math.ceil(basePrice * 100) / 100;
    
    const progress = currentOrders / minOrders;
    const currentModifier = modifierBefore + (progress * (0 - modifierBefore));
    return Math.ceil((basePrice * (1 + currentModifier)) * 100) / 100;
  }

  // At minimum orders exactly
  if (currentOrders === minOrders) {
    return Math.ceil(basePrice * 100) / 100;
  }

  // After minimum orders
  if (modifierAfter && maxStock) {
    const remainingStock = maxStock - minOrders;
    // Safety check for invalid state
    if (remainingStock <= 0) return Math.ceil(basePrice * 100) / 100;
    
    const progress = Math.min((currentOrders - minOrders) / remainingStock, 1);
    const currentModifier = progress * modifierAfter;
    return Math.ceil((basePrice * (1 + currentModifier)) * 100) / 100;
  }

  // If unlimited stock or no after-modifier, only apply before-min modifier
  if (modifierBefore) {
    return Math.ceil((basePrice * (1 + modifierBefore)) * 100) / 100;
  }

  return Math.ceil(basePrice * 100) / 100;
}

/**
 * Calculates the current price modification percentage
 * 
 * @param currentPrice The current modified price
 * @param basePrice The original base price
 * @returns The modification percentage (e.g., -20 for 20% discount, 200 for 200% increase)
 */
export function calculatePriceModificationPercentage(currentPrice: number, basePrice: number): number {
  return Number((((currentPrice - basePrice) / basePrice) * 100).toFixed(2));
} 