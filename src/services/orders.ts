import { supabase } from '../lib/supabase';
import { toastService } from './toast';

interface CreateOrderData {
  productId: string;
  collectionId: string;
  variants?: Array<{ name: string; value: string }>;
  shippingInfo: {
    address: string;
    contactMethod: string;
    contactValue: string;
  };
  transactionId: string;
  walletAddress: string;
  amountSol: number;
}

// Maximum number of retries for order creation
const MAX_RETRIES = 5;
// Base delay in milliseconds (1 second)
const BASE_DELAY = 1000;
// Maximum delay in milliseconds (30 seconds)
const MAX_DELAY = 30000;

// Calculate exponential backoff delay with jitter
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    MAX_DELAY,
    BASE_DELAY * Math.pow(2, attempt)
  );
  // Add random jitter (±20% of delay)
  const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);
  return exponentialDelay + jitter;
}

export async function createOrder(data: CreateOrderData): Promise<string> {
  try {
    // Validate required fields
    if (!data.productId || !data.collectionId || !data.shippingInfo || !data.transactionId || !data.walletAddress || !data.amountSol) {
      throw new Error('Missing required order data');
    }

    let lastError: Error | null = null;

    // First, log the transaction
    const { error: logError } = await supabase.rpc('log_transaction', {
      p_signature: data.transactionId,
      p_amount: data.amountSol,
      p_buyer_address: data.walletAddress,
      p_product_id: data.productId,
      p_status: 'pending'
    });

    if (logError) {
      console.error('Failed to log transaction:', logError);
      // Continue with order creation even if logging fails
    }

    // Create order with enhanced retry logic
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`Attempting to create order (attempt ${attempt + 1}/${MAX_RETRIES})`);
        
        const { error } = await supabase
          .from('orders')
          .insert({
            product_id: data.productId,
            collection_id: data.collectionId,
            shipping_address: {
              address: data.shippingInfo.address
            },
            contact_info: {
              method: data.shippingInfo.contactMethod,
              value: data.shippingInfo.contactValue
            },
            transaction_signature: data.transactionId,
            wallet_address: data.walletAddress,
            status: 'pending',
            amount_sol: data.amountSol
          })
          .select()
          .single();

        if (error) {
          // Check if order already exists (unique constraint violation)
          if (error.code === '23505' && error.message.includes('transaction_signature')) {
            console.log('Order already exists for this transaction');
            // Update transaction log to reflect order exists
            await supabase.rpc('update_transaction_status', {
              p_signature: data.transactionId,
              p_status: 'order_created'
            });
            return data.transactionId;
          }

          console.error(`Database error creating order (attempt ${attempt + 1}):`, error);
          lastError = error;

          // Update transaction log with error
          await supabase.rpc('update_transaction_status', {
            p_signature: data.transactionId,
            p_status: 'order_failed',
            p_error_message: error.message
          });

          // If not the final attempt, wait with exponential backoff
          if (attempt < MAX_RETRIES - 1) {
            const delay = getBackoffDelay(attempt);
            console.log(`Retrying in ${Math.round(delay / 1000)} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          throw error;
        }

        // Update transaction log to reflect successful order creation
        await supabase.rpc('update_transaction_status', {
          p_signature: data.transactionId,
          p_status: 'order_created'
        });

        console.log('Order created successfully');
        toastService.showOrderSuccess();
        return data.transactionId;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error creating order');
        
        // Update transaction log with error
        await supabase.rpc('update_transaction_status', {
          p_signature: data.transactionId,
          p_status: 'order_failed',
          p_error_message: lastError.message
        });

        if (attempt === MAX_RETRIES - 1) {
          throw lastError;
        }

        console.warn(`Order creation attempt ${attempt + 1} failed:`, err);
        const delay = getBackoffDelay(attempt);
        console.log(`Retrying in ${Math.round(delay / 1000)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never happen due to the throw in the loop, but TypeScript doesn't know that
    throw lastError || new Error('Failed to create order after retries');
  } catch (error) {
    console.error('Error creating order:', error);
    // Ensure transaction log is updated with final error state
    await supabase.rpc('update_transaction_status', {
      p_signature: data.transactionId,
      p_status: 'order_failed',
      p_error_message: error instanceof Error ? error.message : 'Failed to create order'
    });
    throw error instanceof Error ? error : new Error('Failed to create order');
  }
}

export async function updateTransactionStatus(
  transactionId: string,
  status: 'confirmed' | 'failed'
): Promise<void> {
  let lastError: Error | null = null;

  // Add retry logic for transaction status updates
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`Attempting to update transaction status (attempt ${attempt + 1}/${MAX_RETRIES})`);

      const { error } = await supabase
        .rpc('update_transaction_status', {
          p_signature: transactionId,
          p_status: status
        });

      if (error) {
        console.error(`Database error updating transaction status (attempt ${attempt + 1}):`, error);
        lastError = error;

        if (attempt < MAX_RETRIES - 1) {
          const delay = getBackoffDelay(attempt);
          console.log(`Retrying in ${Math.round(delay / 1000)} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }

      console.log('Transaction status updated successfully');
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Unknown error updating transaction status');
      
      if (attempt === MAX_RETRIES - 1) {
        throw lastError;
      }

      console.warn(`Transaction status update attempt ${attempt + 1} failed:`, err);
      const delay = getBackoffDelay(attempt);
      console.log(`Retrying in ${Math.round(delay / 1000)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Failed to update transaction status after retries');
}