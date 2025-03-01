import { supabase } from '../lib/supabase';
import type { Order } from '../types/orders';

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

export async function createOrder(data: CreateOrderData): Promise<string> {
  try {
    // Validate required fields
    if (!data.productId || !data.collectionId || !data.shippingInfo || !data.transactionId || !data.walletAddress || !data.amountSol) {
      throw new Error('Missing required order data');
    }

    // Create order with retry logic
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data: order, error } = await supabase
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
          console.error(`Database error creating order (attempt ${attempt + 1}):`, error);
          if (attempt === 2) throw error; // Throw on final attempt
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt))); // Exponential backoff
          continue;
        }

        return data.transactionId;
      } catch (err) {
        if (attempt === 2) throw err;
        console.warn(`Order creation attempt ${attempt + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }

    throw new Error('Failed to create order after retries');
  } catch (error) {
    console.error('Error creating order:', error);
    throw error instanceof Error ? error : new Error('Failed to create order');
  }
}

export async function updateTransactionStatus(
  transactionId: string,
  status: 'confirmed' | 'failed'
): Promise<void> {
  try {
    // Add retry logic for transaction status updates
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { error } = await supabase
          .rpc('update_order_transaction_status', {
            p_transaction_id: transactionId,
            p_status: status
          });

        if (error) {
          console.error(`Database error updating transaction status (attempt ${attempt + 1}):`, error);
          if (attempt === 2) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
          continue;
        }

        return;
      } catch (err) {
        if (attempt === 2) throw err;
        console.warn(`Transaction status update attempt ${attempt + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }

    throw new Error('Failed to update transaction status after retries');
  } catch (error) {
    console.error('Error updating transaction status:', error);
    throw error instanceof Error ? error : new Error('Failed to update transaction status');
  }
}