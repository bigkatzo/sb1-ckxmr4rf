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
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
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
    ENV.SUPABASE_KEY || 'placeholder-key-for-initialization'
  );
} catch (err) {
  console.error('Failed to initialize Supabase client:', err.message);
  // We'll handle this in the handler function
}

let SOLANA_CONNECTION;
const LAMPORTS_PER_SOL = 1000000000;

// Process all pending transactions using frontend-matched RPC implementation
async function verifyPendingTransactions() {
  if (!supabase) {
    console.error('Supabase client not initialized, cannot verify pending transactions');
    return {
      success: false,
      error: 'Database connection not available'
    };
  }
  
  try {
    // Get pending transactions from the database
    const { data: pendingTxs, error: queryError } = await supabase
      .from('payment_transactions')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (queryError) {
      console.error('Error fetching pending transactions:', queryError);
      return {
        success: false,
        error: 'Failed to fetch pending transactions'
      };
    }
    
    if (!pendingTxs || pendingTxs.length === 0) {
      console.log('No pending transactions to verify');
      return {
        success: true,
        verified: 0
      };
    }
    
    console.log(`Found ${pendingTxs.length} pending transactions to verify`);
    
    // Check if we have Solana connection
    if (!SOLANA_CONNECTION) {
      console.error('Solana connection not available, cannot verify transactions');
      return {
        success: false,
        error: 'Blockchain connection not available'
      };
    }
    
    let verifiedCount = 0;
    let failedCount = 0;
    
    // Process each pending transaction
    for (const tx of pendingTxs) {
      try {
        console.log(`Verifying transaction ${tx.signature}...`);
        
        // Use our shared verification function with proper error handling
        const result = await verifyTransaction(SOLANA_CONNECTION, tx.signature);
        
        if (result.isValid) {
          // Transaction is valid, update status to confirmed
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
            failedCount++;
          } else {
            console.log(`Successfully verified transaction ${tx.signature}`);
            verifiedCount++;
            
            // Update associated order if exists
            if (tx.order_id) {
              console.log(`Attempting to confirm order payment for order ${tx.order_id} with signature: ${tx.signature}`);
              
              const { data: confirmData, error: orderError } = await supabase.rpc('confirm_order_payment', {
                p_transaction_signature: tx.signature,
                p_status: 'confirmed'
              });
              
              if (orderError) {
                console.error(`Failed to update order for transaction ${tx.signature}:`, orderError);
              } else {
                console.log('Order payment confirmation result:', confirmData);
                
                // Additional check to verify if the order was updated
                const { data: orderCheck, error: orderCheckError } = await supabase
                  .from('orders')
                  .select('id, status')
                  .eq('id', tx.order_id)
                  .single();
                  
                if (orderCheckError) {
                  console.warn(`Could not verify order ${tx.order_id} status after confirmation:`, orderCheckError);
                } else {
                  console.log(`Order ${tx.order_id} status after confirmation attempt:`, orderCheck);
                  
                  // If order still in pending_payment, try direct update
                  if (orderCheck && orderCheck.status === 'pending_payment') {
                    console.log(`Order ${tx.order_id} status still pending, trying direct update`);
                    
                    const { error: directUpdateError } = await supabase
                      .from('orders')
                      .update({ 
                        status: 'confirmed',
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', tx.order_id)
                      .eq('status', 'pending_payment');
                      
                    if (directUpdateError) {
                      console.error(`Direct order update failed for order ${tx.order_id}:`, directUpdateError);
                    } else {
                      console.log(`Direct order update succeeded for order ${tx.order_id}`);
                    }
                  }
                }
              }
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
      console.log('Initializing Solana connection with frontend-matched implementation...');
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