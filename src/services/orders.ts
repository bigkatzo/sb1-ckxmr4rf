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
    console.log(`Attempting to create order (attempt ${attempt + 1}/${MAX_RETRIES})`, {
      productId: data.productId,
      transactionId: data.transactionId,
      hasVariants: data.variant_selections && data.variant_selections.length > 0,
      amountSol: data.amountSol
    });

    // Check if order already exists for this transaction
    try {
      const { data: existingOrders, error: existingOrderError } = await supabase
        .from('orders')
        .select('*')
        .eq('transaction_signature', data.transactionId);

      if (existingOrderError) {
        console.error('Error checking for existing orders:', existingOrderError);
        // Continue with order creation even if check fails
      } else if (existingOrders && existingOrders.length > 0) {
        console.log('Order already exists for this transaction:', {
          orderId: existingOrders[0].id,
          status: existingOrders[0].status
        });
        return existingOrders[0];
      } else {
        console.log('No existing order found, proceeding with creation');
      }
    } catch (checkError) {
      console.error('Exception checking for existing order:', checkError);
      // Continue with order creation even if check fails
    }

    // Verify the transaction amount from the blockchain
    try {
      console.log('Verifying transaction amount from transaction logs');
      const { data: txLogs, error: txLogError } = await supabase
        .from('transaction_logs')
        .select('amount, status')
        .eq('signature', data.transactionId);

      if (txLogError) {
        console.warn('Could not verify transaction amount from logs:', txLogError);
      } else if (txLogs && txLogs.length > 0) {
        if (txLogs[0].amount) {
          // Use the actual transaction amount from the logs
          console.log(`Using verified transaction amount: ${txLogs[0].amount} SOL (provided: ${data.amountSol} SOL)`);
          data.amountSol = txLogs[0].amount;
        }
        console.log('Transaction log status:', txLogs[0].status);
      } else {
        console.log('No transaction log found, using provided amount');
      }
    } catch (verifyError) {
      console.warn('Error verifying transaction amount:', verifyError);
      // Continue with the provided amount if verification fails
    }

    // Try using the database function first (more reliable)
    try {
      console.log('Attempting to create order using database function');
      const { data: orderId, error: functionError } = await supabase.rpc('create_order', {
        p_product_id: data.productId,
        p_variants: data.variant_selections || [],
        p_shipping_info: {
          shipping_address: data.shippingInfo.shipping_address,
          contact_info: data.shippingInfo.contact_info
        },
        p_wallet_address: data.walletAddress
      });

      if (functionError) {
        console.error('Error using create_order function:', functionError);
        throw functionError;
      }

      if (orderId) {
        console.log('Order created successfully, updating with transaction details:', orderId);
        
        // Update order with transaction details
        try {
          const { error: updateError } = await supabase.rpc('update_order_transaction', {
            p_order_id: orderId,
            p_transaction_signature: data.transactionId,
            p_amount_sol: data.amountSol
          });

          if (updateError) {
            console.error('Error updating order transaction:', updateError);
            throw updateError;
          }
          
          console.log('Order transaction details updated successfully');

          // Fetch the created order
          const { data: createdOrders, error: fetchError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId);

          if (fetchError) {
            console.error('Error fetching created order:', fetchError);
            throw fetchError;
          }

          if (!createdOrders || createdOrders.length === 0) {
            throw new Error('Order was created but could not be retrieved');
          }

          console.log('Order creation completed successfully:', {
            orderId: createdOrders[0].id,
            status: createdOrders[0].status
          });
          return createdOrders[0];
        } catch (updateError) {
          console.error('Exception updating order transaction:', updateError);
          throw updateError;
        }
      }
      
      throw new Error('Failed to create order: No order ID returned');
    } catch (error) {
      console.error('Order creation failed:', error);
      throw error;
    }
  } catch (error) {
    console.error(`Order creation attempt ${attempt + 1} failed:`, error);
    
    // Log the error to the transaction_logs table if this is the final attempt
    if (attempt >= MAX_RETRIES - 1) {
      try {
        // Only try to log if the function exists
        const { error: logError } = await supabase.rpc('log_order_creation_error', {
          p_signature: data.transactionId,
          p_error_message: error instanceof Error ? error.message : 'Unknown order creation error'
        });
        
        if (logError) {
          console.warn('Failed to log order creation error (function may not exist yet):', logError);
        } else {
          console.log('Order creation error logged to transaction_logs');
        }
      } catch (logError) {
        console.error('Failed to log order creation error:', logError);
      }
    }
    
    if (attempt >= MAX_RETRIES) {
      console.error('Max retries reached for order creation:', error);
      throw error;
    }

    const delay = getBackoffDelay(attempt);
    console.log(`Retrying in ${Math.round(delay / 1000)} seconds...`);
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
          p_status: status,
          p_details: null
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