/**
 * Utility functions for handling transaction signatures
 */

/**
 * Determines if a transaction signature is a Stripe receipt URL
 */
export function isStripeReceiptUrl(signature: string): boolean {
  return signature.startsWith('https://') && 
         (signature.includes('stripe.com/receipts') || 
          signature.includes('pay.stripe.com') ||
          signature.includes('invoice.stripe.com'));
}

/**
 * Gets the appropriate URL for viewing a transaction
 */
export function getTransactionUrl(signature: string): string {
  if (isStripeReceiptUrl(signature)) {
    return signature; // It's already a URL
  }
  
  // For Stripe payment intents, use the customer-facing receipt URL
  // This URL is accessible to customers without Stripe account access
  if (signature?.startsWith('pi_')) {
    return `https://pay.stripe.com/receipts/payment/${signature}`;
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
  
  // For Stripe payment intents
  if (signature?.startsWith('pi_')) {
    return 'Payment Receipt';
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
  
  if (signature?.startsWith('pi_')) {
    return 'Payment';
  }
  
  return 'Transaction';
} 