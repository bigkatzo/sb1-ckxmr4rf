import { supabase } from '../lib/supabase';
import { Order } from '../types/orders';

interface CreateOrderData {
  productId: string;
  collectionId: string;
  variant_selections?: Array<{ name: string; value: string }>;
  shippingInfo: {
    shipping_address: {
      address: string;
      city: string;
      country: string;
      zip: string;
    };
    contact_info: {
      method: string;
      value: string;
    };
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

export async function createOrder(data: CreateOrderData, attempt = 0): Promise<Order> {
  try {
    // Check if order already exists for this transaction
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('transaction_signature', data.transactionId)
      .single();

    if (existingOrder) {
      return existingOrder;
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        product_id: data.productId,
        collection_id: data.collectionId,
        variant_selections: data.variant_selections || [],
        shipping_address: data.shippingInfo.shipping_address,
        contact_info: data.shippingInfo.contact_info,
        transaction_signature: data.transactionId,
        wallet_address: data.walletAddress,
        status: 'pending',
        amount_sol: data.amountSol
      }])
      .select()
      .single();

    if (error) throw error;
    if (!order) throw new Error('No order data returned');

    return order;
  } catch (error) {
    if (attempt >= MAX_RETRIES) {
      console.error('Max retries reached for order creation:', error);
      throw error;
    }

    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
    return createOrder(data, attempt + 1);
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