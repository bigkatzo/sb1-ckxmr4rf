import { isValidStrictToken, hasConsistentStrictTokens, hasMixedStrictTokens, hasDifferentStrictTokens } from './strictTokenValidation';

// Test data
const validToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
const anotherValidToken = 'So11111111111111111111111111111111111111112'; // SOL

const testItems = [
  { product: { collectionStrictToken: validToken } },
  { product: { collectionStrictToken: validToken } },
  { product: { collectionStrictToken: validToken } }
];

const mixedItems = [
  { product: { collectionStrictToken: validToken } },
  { product: { collectionStrictToken: null } },
  { product: { collectionStrictToken: 'NULL' } }
];

const differentTokenItems = [
  { product: { collectionStrictToken: validToken } },
  { product: { collectionStrictToken: anotherValidToken } },
  { product: { collectionStrictToken: validToken } }
];

// Manual test function for quick verification
export function runStrictTokenValidationTests() {
  console.log('Running Strict Token Validation Tests...\n');

  // Test isValidStrictToken
  console.log('Testing isValidStrictToken:');
  console.log(`Valid token (USDC): ${isValidStrictToken(validToken)}`); // Should be true
  console.log(`Valid token (SOL): ${isValidStrictToken(anotherValidToken)}`); // Should be true
  console.log(`NULL: ${isValidStrictToken('NULL')}`); // Should be false
  console.log(`null: ${isValidStrictToken('null')}`); // Should be false
  console.log(`Empty string: ${isValidStrictToken('')}`); // Should be false
  console.log(`Undefined: ${isValidStrictToken(undefined)}`); // Should be false
  console.log(`Null: ${isValidStrictToken(null)}`); // Should be false
  console.log(`"none": ${isValidStrictToken('none')}`); // Should be false
  console.log(`"n/a": ${isValidStrictToken('n/a')}`); // Should be false
  console.log('');

  // Test hasConsistentStrictTokens
  console.log('Testing hasConsistentStrictTokens:');
  console.log(`All same valid tokens: ${hasConsistentStrictTokens(testItems, (item) => item.product.collectionStrictToken)}`); // Should be true
  console.log(`Mixed valid/invalid: ${hasConsistentStrictTokens(mixedItems, (item) => item.product.collectionStrictToken)}`); // Should be false
  console.log(`Different valid tokens: ${hasConsistentStrictTokens(differentTokenItems, (item) => item.product.collectionStrictToken)}`); // Should be false
  console.log('');

  // Test hasMixedStrictTokens
  console.log('Testing hasMixedStrictTokens:');
  console.log(`All same valid tokens: ${hasMixedStrictTokens(testItems, (item) => item.product.collectionStrictToken)}`); // Should be false
  console.log(`Mixed valid/invalid: ${hasMixedStrictTokens(mixedItems, (item) => item.product.collectionStrictToken)}`); // Should be true
  console.log(`Different valid tokens: ${hasMixedStrictTokens(differentTokenItems, (item) => item.product.collectionStrictToken)}`); // Should be false
  console.log('');

  // Test hasDifferentStrictTokens
  console.log('Testing hasDifferentStrictTokens:');
  console.log(`All same valid tokens: ${hasDifferentStrictTokens(testItems, (item) => item.product.collectionStrictToken)}`); // Should be false
  console.log(`Mixed valid/invalid: ${hasDifferentStrictTokens(mixedItems, (item) => item.product.collectionStrictToken)}`); // Should be false
  console.log(`Different valid tokens: ${hasDifferentStrictTokens(differentTokenItems, (item) => item.product.collectionStrictToken)}`); // Should be true
  console.log('');

  console.log('All tests completed!');
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - can be called from console
  (window as any).testStrictTokenValidation = runStrictTokenValidationTests;
} 