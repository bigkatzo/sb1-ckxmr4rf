/**
 * Utility functions for validating strict tokens
 */

/**
 * Checks if a strict token value is valid
 * @param strictToken - The strict token value to validate
 * @returns true if the token is valid, false otherwise
 */
export function isValidStrictToken(strictToken: string | null | undefined): boolean {
  if (!strictToken) return false;
  
  const token = String(strictToken).trim();
  
  // Check for null, "NULL", empty string, or other invalid values
  if (token === '' || 
      token.toLowerCase() === 'null' || 
      token === 'undefined' || 
      token === 'none' ||
      token === 'n/a') {
    return false;
  }
  
  // Basic validation for Solana address format (base58, 32-44 characters)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(token);
}

/**
 * Filters items to only include those with valid strict tokens
 * @param items - Array of cart items or products
 * @param getStrictToken - Function to extract strict token from item
 * @returns Array of items with valid strict tokens
 */
export function filterValidStrictTokenItems<T>(
  items: T[], 
  getStrictToken: (item: T) => string | null | undefined
): T[] {
  return items.filter(item => {
    const strictToken = getStrictToken(item);
    return isValidStrictToken(strictToken);
  });
}

/**
 * Checks if all items have the same valid strict token
 * @param items - Array of cart items or products
 * @param getStrictToken - Function to extract strict token from item
 * @returns true if all items have the same valid strict token, false otherwise
 */
export function hasConsistentStrictTokens<T>(
  items: T[], 
  getStrictToken: (item: T) => string | null | undefined
): boolean {
  const validStrictTokenItems = filterValidStrictTokenItems(items, getStrictToken);
  
  if (validStrictTokenItems.length === 0) return false;
  if (validStrictTokenItems.length !== items.length) return false;
  
  const firstStrictToken = getStrictToken(validStrictTokenItems[0]);
  return validStrictTokenItems.every(item => 
    getStrictToken(item) === firstStrictToken
  );
}

/**
 * Checks if there are mixed strict token items (some with valid strict tokens, some without)
 * @param items - Array of cart items or products
 * @param getStrictToken - Function to extract strict token from item
 * @returns true if there are mixed strict token items, false otherwise
 */
export function hasMixedStrictTokens<T>(
  items: T[], 
  getStrictToken: (item: T) => string | null | undefined
): boolean {
  const validStrictTokenItems = filterValidStrictTokenItems(items, getStrictToken);
  const invalidStrictTokenItems = items.filter(item => 
    !isValidStrictToken(getStrictToken(item))
  );
  
  return validStrictTokenItems.length > 0 && invalidStrictTokenItems.length > 0;
}

/**
 * Checks if there are different valid strict tokens among items
 * @param items - Array of cart items or products
 * @param getStrictToken - Function to extract strict token from item
 * @returns true if there are different valid strict tokens, false otherwise
 */
export function hasDifferentStrictTokens<T>(
  items: T[], 
  getStrictToken: (item: T) => string | null | undefined
): boolean {
  const validStrictTokenItems = filterValidStrictTokenItems(items, getStrictToken);
  
  if (validStrictTokenItems.length <= 1) return false;
  
  const firstStrictToken = getStrictToken(validStrictTokenItems[0]);
  return validStrictTokenItems.some(item => 
    getStrictToken(item) !== firstStrictToken
  );
} 