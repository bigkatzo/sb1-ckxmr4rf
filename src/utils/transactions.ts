/**
 * Utility functions for handling transaction signatures
 */

/**
 * Determines if a transaction signature is a Stripe receipt URL
 */
export function isStripeReceiptUrl(signature: string): boolean {
  return signature.startsWith('https://') && 
         (signature.includes('stripe.com/receipts') || 
          signature.includes('pay.stripe.com'));
}

/**
 * Gets the appropriate URL for viewing a transaction
 */
export function getTransactionUrl(signature: string): string {
  if (isStripeReceiptUrl(signature)) {
    return signature; // It's already a URL
  }
  
  // Default to Solscan for Solana transactions
  return `https://solscan.io/tx/${signature}`;
}

/**
 * Formats a transaction signature for display
 */
export function formatTransactionSignature(signature: string): string {
  if (isStripeReceiptUrl(signature)) {
    return 'Stripe Receipt';
  }
  
  // For Solana transactions, show abbreviated form
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
}

/**
 * Renders a transaction signature with appropriate icon and styling
 */
export function getTransactionLabel(signature: string): string {
  if (isStripeReceiptUrl(signature)) {
    return 'Payment Receipt';
  }
  
  return 'Transaction';
} 