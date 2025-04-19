/**
 * VERIFY PENDING TRANSACTIONS
 * 
 * This function runs periodically to check the status of pending blockchain transactions
 * Implementation exactly matches the frontend approach for RPC connections
 */

let Connection, PublicKey;
try {
  // Try to import Solana packages
  const solanaWeb3 = require('@solana/web3.js');
  Connection = solanaWeb3.Connection;
  PublicKey = solanaWeb3.PublicKey;
} catch (err) {
  console.error('Failed to load @solana/web3.js:', err.message);
}

const { createClient } = require('@supabase/supabase-js');

// Import our shared RPC service that exactly matches frontend implementation
const { createConnectionWithRetry, verifyTransaction } = require('./shared/rpc-service');

// Environment variables with multiple fallbacks
const ENV = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // Helius API Key
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || process.env.VITE_HELIUS_API_KEY || '',
  
  // Alchemy API Key
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY || process.env.VITE_ALCHEMY_API_KEY || ''
};

// Initialize Supabase with fallback error handling
let supabase;
try {
  supabase = createClient(
    ENV.SUPABASE_URL || 'https://placeholder-url.supabase.co',
    ENV.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key-for-initialization'
  );
  console.log('Supabase client initialized successfully with service role permissions');
} catch (err) {
  console.error('Failed to initialize Supabase client:', err.message);
  // We'll handle this in the handler function
}

let SOLANA_CONNECTION;
const LAMPORTS_PER_SOL = 1000000000;

// Process all pending transactions using frontend-matched RPC implementation
async function verifyPendingTransactions() {
  if (!supabase) {
    return {
      success: false,
      error: 'Supabase client not initialized'
    };
  }
  
  try {
    // Find pending/unconfirmed transactions
    console.log('Looking for pending transactions...');
    
    const { data: pendingTxs, error: queryError } = await supabase
      .from('transactions')
      .select('signature, product_id, amount, buyer_address, retry_count, status, order_id')
      .or('status->success.is.null,status->success.eq.false')
      .lt('retry_count', 5);
      
    if (queryError) {
      console.error('Failed to query pending transactions:', queryError);
      return {
        success: false,
        error: queryError.message
      };
    }
    
    if (!pendingTxs || pendingTxs.length === 0) {
      console.log('No pending transactions found');
      return {
        success: true,
        verified: 0,
        failed: 0,
        total: 0
      };
    }
    
    console.log(`Found ${pendingTxs.length} pending transactions to verify`);
    
    let verifiedCount = 0;
    let failedCount = 0;
    
    // Process each pending transaction using the improved verify-transaction logic
    for (const tx of pendingTxs) {
      try {
        console.log(`Verifying transaction ${tx.signature}...`);
        
        // Use our shared verification function with proper error handling
        const result = await verifyTransaction(SOLANA_CONNECTION, tx.signature);
        
        if (result.isValid) {
          // Find all orders associated with this transaction
          const { data: relatedOrders, error: findError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('transaction_signature', tx.signature)
            .in('status', ['pending_payment', 'draft']);
            
          if (findError) {
            console.error(`Failed to find orders for transaction ${tx.signature}:`, findError);
          } else if (relatedOrders && relatedOrders.length > 0) {
            console.log(`Found ${relatedOrders.length} orders to update for transaction ${tx.signature}`);
            
            // Update transaction status to confirmed
            const { error: updateError } = await supabase.rpc('update_transaction_status', {
              p_signature: tx.signature,
              p_status: 'confirmed',
              p_details: {
                verifiedAt: new Date().toISOString(),
                automated: true
              }
            });
            
            if (updateError) {
              console.error(`Failed to update transaction ${tx.signature}:`, updateError);
            } else {
              console.log(`Updated transaction ${tx.signature} status to confirmed`);
            }
            
            // Update each associated order
            let updatedCount = 0;
            for (const order of relatedOrders) {
              try {
                // For orders in DRAFT status, first transition to PENDING_PAYMENT
                if (order.status === 'draft') {
                  console.log(`Order ${order.id} is in DRAFT status, transitioning to PENDING_PAYMENT first`);
                  
                  // Use update_order_transaction to move from DRAFT to PENDING_PAYMENT
                  const { error: transitionError } = await supabase.rpc('update_order_transaction', {
                    p_order_id: order.id,
                    p_transaction_signature: tx.signature,
                    p_amount_sol: tx.amount || 0
                  });
                  
                  if (transitionError) {
                    console.error(`Failed to transition order ${order.id} from DRAFT to PENDING_PAYMENT:`, transitionError);
                    continue;
                  }
                  
                  console.log(`Successfully transitioned order ${order.id} from DRAFT to PENDING_PAYMENT`);
                  
                  // Refresh order data to get the updated status
                  const { data: refreshedOrder, error: refreshError } = await supabase
                    .from('orders')
                    .select('id, status')
                    .eq('id', order.id)
                    .single();
                    
                  if (refreshError) {
                    console.error(`Failed to refresh order ${order.id} data:`, refreshError);
                    continue;
                  }
                  
                  // Update local reference to use the refreshed data
                  order.status = refreshedOrder.status;
                }
                
                // Now proceed with confirmation if order is in PENDING_PAYMENT
                if (order.status === 'pending_payment') {
                  // Use direct_update_order_status for consistent behavior
                  const { data: updateResult, error: orderError } = await supabase.rpc('direct_update_order_status', {
                    p_order_id: order.id,
                    p_status: 'confirmed'
                  });
                  
                  if (orderError) {
                    console.error(`Failed to update order ${order.id}:`, orderError);
                    
                    // Try fallback direct update method
                    const { error: directError } = await supabase
                      .from('orders')
                      .update({ status: 'confirmed' })
                      .eq('id', order.id)
                      .eq('status', 'pending_payment');
                      
                    if (!directError) {
                      console.log(`Successfully updated order ${order.id} with fallback method`);
                      updatedCount++;
                    } else {
                      console.error(`Failed to update order ${order.id} with fallback method:`, directError);
                    }
                  } else {
                    console.log(`Successfully updated order ${order.id} to CONFIRMED status`);
                    updatedCount++;
                  }
                } else if (order.status === 'confirmed') {
                  console.log(`Order ${order.id} is already in CONFIRMED status, no update needed`);
                  updatedCount++;
                } else {
                  console.warn(`Order ${order.id} is in unexpected status: ${order.status}, not updating`);
                }
              } catch (orderError) {
                console.error(`Error processing order ${order.id}:`, orderError);
              }
            }
            
            console.log(`Updated ${updatedCount} of ${relatedOrders.length} orders for transaction ${tx.signature}`);
            verifiedCount++;
          } else {
            console.log(`No pending orders found for verified transaction ${tx.signature}`);
            
            // Still mark transaction as verified even if no orders were found
            const { error: updateError } = await supabase.rpc('update_transaction_status', {
              p_signature: tx.signature,
              p_status: 'confirmed',
              p_details: {
                verifiedAt: new Date().toISOString(),
                automated: true,
                noOrdersFound: true
              }
            });
            
            if (updateError) {
              console.error(`Failed to update transaction ${tx.signature}:`, updateError);
            } else {
              console.log(`Updated transaction ${tx.signature} status to confirmed (no orders found)`);
              verifiedCount++;
            }
          }
        } else {
          // Transaction verification failed
          const { error: updateError } = await supabase.rpc('update_transaction_status', {
            p_signature: tx.signature,
            p_status: 'failed',
            p_details: {
              error: result.error,
              verifiedAt: new Date().toISOString(),
              automated: true
            }
          });
          
          if (updateError) {
            console.error(`Failed to update failed transaction ${tx.signature}:`, updateError);
          } else {
            console.log(`Marked transaction ${tx.signature} as failed: ${result.error}`);
            failedCount++;
          }
        }
      } catch (txError) {
        console.error(`Error processing transaction ${tx.signature}:`, txError);
        failedCount++;
      }
    }
    
    return {
      success: true,
      verified: verifiedCount,
      failed: failedCount,
      total: pendingTxs.length
    };
  } catch (error) {
    console.error('Error verifying pending transactions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

exports.handler = async (event, context) => {
  // Initialize Solana connection with our robust service if necessary
  if (!SOLANA_CONNECTION && Connection) {
    try {
      console.log('Initializing Solana connection...');
      SOLANA_CONNECTION = await createConnectionWithRetry(ENV);
    } catch (err) {
      console.error('Failed to initialize Solana connection:', err.message);
    }
  }
  
  try {
    const result = await verifyPendingTransactions();
    
    return {
      statusCode: result.success ? 200 : 500,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error in verify-pending-transactions function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}; 