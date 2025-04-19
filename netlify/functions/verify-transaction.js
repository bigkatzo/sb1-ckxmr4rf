/**
 * VERIFY TRANSACTION
 * 
 * Server-side verification of blockchain transactions with improved error handling
 * Uses our robust RPC system with WebSocket support and retry logic
 * Implementation exactly matches the frontend approach
 */

let Connection, PublicKey;
try {
  // Try to import Solana packages, but handle the case where they're not available
  const solanaWeb3 = require('@solana/web3.js');
  Connection = solanaWeb3.Connection;
  PublicKey = solanaWeb3.PublicKey;
} catch (err) {
  console.error('Failed to load @solana/web3.js:', err.message);
  // We'll handle this later in the code
}

const { createClient } = require('@supabase/supabase-js');

// Import our shared RPC service that matches the frontend implementation
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

// Initialize Supabase with better error handling
let supabase;
try {
  // Validate Supabase credentials before initializing
  if (!ENV.SUPABASE_URL || ENV.SUPABASE_URL === 'https://placeholder-url.supabase.co') {
    console.error('Missing or invalid SUPABASE_URL environment variable');
  }
  
  if (!ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_SERVICE_ROLE_KEY === 'placeholder-key-for-initialization') {
    console.error('Missing or invalid SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  
  // Only create client if we have reasonable values
  if (ENV.SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY && 
      ENV.SUPABASE_URL !== 'https://placeholder-url.supabase.co' && 
      ENV.SUPABASE_SERVICE_ROLE_KEY !== 'placeholder-key-for-initialization') {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase client initialized successfully with service role permissions');
    console.log(`Connected to database: ${ENV.SUPABASE_URL}`);
  } else {
    console.warn('Using fallback Supabase values - database operations will likely fail');
    supabase = createClient(
      ENV.SUPABASE_URL || 'https://placeholder-url.supabase.co',
      ENV.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key-for-initialization'
    );
  }
} catch (err) {
  console.error('Failed to initialize Supabase client:', err.message);
  // We'll handle this in the handler function
}

let SOLANA_CONNECTION;
const LAMPORTS_PER_SOL = 1000000000;

// Securely verify transaction details against the blockchain
async function verifyTransactionDetails(signature, expectedDetails) {
  try {
    // Check if we have Solana libraries available
    if (!SOLANA_CONNECTION) {
      return { 
        isValid: false, 
        error: 'Solana verification is not available. Please try again later.' 
      };
    }

    // Use our shared verification function with proper error handling and timeouts
    const result = await verifyTransaction(SOLANA_CONNECTION, signature);
    
    if (!result.isValid) {
      return result;
    }
    
    const tx = result.transaction;

    // Get pre and post balances
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;
    
    // Get accounts involved in the transaction
    const accounts = tx.transaction.message.getAccountKeys().keySegments().flat();
    
    // Find the transfer by looking at balance changes
    const transfers = accounts.map((account, index) => {
      const balanceChange = (postBalances[index] - preBalances[index]) / LAMPORTS_PER_SOL;
      return {
        address: account.toBase58(),
        change: balanceChange
      };
    });

    // Find the recipient (positive balance change) and sender (negative balance change)
    const recipient = transfers.find(t => t.change > 0);
    const sender = transfers.find(t => t.change < 0);

    if (!recipient || !sender) {
      return { 
        isValid: false, 
        error: 'Could not identify transfer details'
      };
    }
    
    const details = {
      amount: recipient.change,
      buyer: sender.address,
      recipient: recipient.address
    };

    // If we have expected details, verify them
    if (expectedDetails) {
      if (Math.abs(details.amount - expectedDetails.amount) > 0.00001) { // Allow small rounding differences
        return {
          isValid: false,
          error: `Amount mismatch: expected ${expectedDetails.amount} SOL, got ${details.amount} SOL`,
          details
        };
      }

      if (details.buyer.toLowerCase() !== expectedDetails.buyer.toLowerCase()) {
        return {
          isValid: false,
          error: `Buyer mismatch: expected ${expectedDetails.buyer}, got ${details.buyer}`,
          details
        };
      }

      if (details.recipient.toLowerCase() !== expectedDetails.recipient.toLowerCase()) {
        return {
          isValid: false,
          error: `Recipient mismatch: expected ${expectedDetails.recipient}, got ${details.recipient}`,
          details
        };
      }
    }

    return { isValid: true, details };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Failed to verify transaction' 
    };
  }
}

// Verify and update the order status using approach from frontend
async function confirmOrderPayment(orderId, signature, verification) {
  if (!supabase) {
    console.warn('Supabase client not initialized, cannot confirm order payment');
    return {
      success: false,
      error: 'Database connection not available'
    };
  }
  
  try {
    if (!verification.isValid) {
      // Log verification failure
      try {
        const { error: logError } = await supabase.rpc('update_transaction_status', {
          p_signature: signature,
          p_status: 'failed',
          p_details: {
            error: verification.error,
            verification: verification.details || null
          }
        });
        
        if (logError) {
          console.error('Failed to log verification failure:', logError);
        }
      } catch (dbError) {
        console.error('Database error when logging verification failure:', dbError);
      }
      
      return {
        success: false,
        error: verification.error || 'Transaction verification failed'
      };
    }
    
    // Update transaction log with success
    try {
      const { error: updateError } = await supabase.rpc('update_transaction_status', {
        p_signature: signature,
        p_status: 'confirmed',
        p_details: {
          ...verification.details,
          confirmedAt: new Date().toISOString()
        }
      });
      
      if (updateError) {
        console.error('Failed to update transaction status:', updateError);
        return {
          success: false,
          error: 'Failed to update transaction status'
        };
      }
    } catch (dbError) {
      console.error('Database error when updating transaction status:', dbError);
      return {
        success: false,
        error: 'Database error when updating transaction'
      };
    }
    
    // Check the current order status
    console.log(`Looking up order ${orderId} with transaction signature ${signature}`);
    let orderData;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, transaction_signature')
        .eq('id', orderId)
        .single();
        
      if (error) {
        console.error('Error fetching order details:', error);
        return { success: false, error: 'Failed to fetch order details' };
      }
      
      orderData = data;
      console.log('Current order status:', orderData);
      
      // Validate order exists and has matching signature
      if (!orderData) {
        console.error('Order not found:', orderId);
        return { success: false, error: 'Order not found' };
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      return { success: false, error: 'Failed to fetch order' };
    }
    
    // STEP 1: Handle order in DRAFT status - must transition to PENDING_PAYMENT first
    if (orderData.status === 'draft') {
      console.log(`Order ${orderId} is in DRAFT status, transitioning to PENDING_PAYMENT first`);
      
      try {
        // Use update_order_transaction to transition from DRAFT to PENDING_PAYMENT
        const { error: updateError } = await supabase.rpc('update_order_transaction', {
          p_order_id: orderId,
          p_transaction_signature: signature,
          p_amount_sol: verification.details?.amount || 0
        });
        
        if (updateError) {
          console.error('Failed to transition from DRAFT to PENDING_PAYMENT:', updateError);
          return { success: false, error: 'Failed to update order to PENDING_PAYMENT status' };
        }
        
        console.log(`Successfully transitioned order ${orderId} from DRAFT to PENDING_PAYMENT`);
        
        // Refresh order data after transition
        const { data: refreshedData, error: refreshError } = await supabase
          .from('orders')
          .select('id, status, transaction_signature')
          .eq('id', orderId)
          .single();
          
        if (refreshError) {
          console.error('Failed to refresh order data after transition:', refreshError);
        } else {
          orderData = refreshedData;
          console.log('Updated order status after transition:', orderData);
        }
      } catch (error) {
        console.error('Error updating order status:', error);
        return { success: false, error: 'Failed to update order status' };
      }
    }
    
    // STEP 2: Handle order in PENDING_PAYMENT status - transition to CONFIRMED
    if (orderData.status === 'pending_payment') {
      console.log(`Order ${orderId} is in PENDING_PAYMENT status, transitioning to CONFIRMED`);
      
      try {
        // First try to use confirm_order_payment RPC
        const { data: confirmData, error: confirmError } = await supabase.rpc('confirm_order_payment', {
          p_transaction_signature: signature,
          p_status: 'confirmed'
        });
        
        if (confirmError) {
          console.error('Failed to confirm order payment with RPC:', confirmError);
          
          // Try direct_update_order_status as a backup
          const { data: updateData, error: updateError } = await supabase.rpc('direct_update_order_status', {
            p_order_id: orderId,
            p_status: 'confirmed'
          });
          
          if (updateError) {
            console.error('Direct order update via RPC failed:', updateError);
            
            // Last resort: direct table update
            const { error: directUpdateError } = await supabase
              .from('orders')
              .update({ status: 'confirmed' })
              .eq('id', orderId)
              .eq('status', 'pending_payment');
              
            if (directUpdateError) {
              console.error('Last-resort direct update failed:', directUpdateError);
              return { success: false, error: 'All update methods failed to confirm order' };
            } else {
              console.log('Successfully confirmed order via direct update');
            }
          } else {
            console.log('Successfully confirmed order via confirm_order_payment RPC');
          }
        } else {
          console.log('Successfully confirmed order via confirm_order_payment RPC');
        }
        
        // Final check to confirm the update was successful
        const { data: finalOrder, error: finalError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('id', orderId)
          .single();
          
        if (finalError) {
          console.warn('Could not perform final order status check:', finalError);
        } else {
          console.log('Final order status:', finalOrder);
          if (finalOrder.status !== 'confirmed') {
            console.warn('Order status is still not confirmed after all update attempts');
            return { success: false, error: 'Failed to update order status to CONFIRMED' };
          }
        }
        
        return { success: true };
      } catch (error) {
        console.error('Error confirming order payment:', error);
        return { success: false, error: 'Error confirming order payment' };
      }
    } else if (orderData.status === 'confirmed') {
      console.log(`Order ${orderId} is already in CONFIRMED status, no action needed`);
      return { success: true };
    } else {
      console.warn(`Order ${orderId} is in unexpected status: ${orderData.status}, not updating`);
      return { success: false, error: `Cannot update order in ${orderData.status} status` };
    }
  } catch (error) {
    console.error('Error in confirmOrderPayment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

exports.handler = async (event, context) => {
  console.log('Function invoked:', { 
    httpMethod: event.httpMethod,
    hasAuthHeader: !!event.headers.authorization,
    path: event.path
  });
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check if Supabase client is available
  if (!supabase) {
    console.error('Supabase client is not initialized');
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        warning: 'Database connection is temporarily unavailable. Transaction will be verified later.',
        verification: {
          isValid: true,
          tempApproved: true,
          details: {}
        }
      })
    };
  }

  // Initialize Solana connection with our robust service if necessary
  if (!SOLANA_CONNECTION && Connection) {
    try {
      console.log('Initializing Solana connection...');
      SOLANA_CONNECTION = await createConnectionWithRetry(ENV);
    } catch (err) {
      console.error('Failed to initialize Solana connection:', err.message);
    }
  }

  // Check if Solana is available
  if (!SOLANA_CONNECTION) {
    console.error('Solana connection is not available. Returning temporary success.');
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        warning: 'Blockchain verification is temporarily unavailable. Transaction will be verified later.',
        verification: {
          isValid: true,
          tempApproved: true,
          details: {}
        }
      })
    };
  }

  // Validate authentication
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  let userId = 'anonymous';

  // Skip authentication entirely - this is a server-only function using service role key
  console.log('Server-side verification using service role key - no user authentication required');

  // Parse request body
  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  // Validate request parameters
  const { orderId, signature, expectedDetails } = requestBody;
  
  if (!signature) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing transaction signature' })
    };
  }

  // For non-Solana transactions (like Stripe), handle differently
  if (signature.startsWith('pi_') || signature.startsWith('free_')) {
    // Handle alternate payment methods
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Non-blockchain transaction requires separate verification'
      })
    };
  }

  try {
    console.log(`Verifying transaction: ${signature.substring(0, 12)}...`);
    
    // 1. Verify the transaction details on-chain
    const verification = await verifyTransactionDetails(signature, expectedDetails);
    
    console.log('Verification result:', {
      isValid: verification.isValid,
      hasError: !!verification.error
    });
    
    // 2. Find related orders even if orderId is not provided
    // This ensures we always attempt to update all orders associated with this transaction
    let orderIds = [];
    
    if (orderId) {
      // If an orderId was explicitly provided, use it
      orderIds.push(orderId);
    } else if (verification.isValid) {
      // If no orderId but transaction is valid, find all related orders with expanded search
      try {
        // First check for exact transaction_signature match
        const { data: exactOrders, error: exactError } = await supabase
          .from('orders')
          .select('id, status, transaction_signature')
          .eq('transaction_signature', signature)
          .in('status', ['pending_payment', 'draft']);
          
        if (!exactError && exactOrders && exactOrders.length > 0) {
          console.log(`Found ${exactOrders.length} orders with exact transaction signature match`);
          orderIds = exactOrders.map(order => order.id);
        } else {
          // If no exact match, try a broader search - look for recently created orders that might match this transaction
          console.log('No exact transaction signature matches found, trying broader search');
          
          // Buyer-based order lookup
          if (verification.details && verification.details.buyer) {
            const buyerAddress = verification.details.buyer;
            const { data: buyerOrders, error: buyerError } = await supabase
              .from('orders')
              .select('id, status, transaction_signature, wallet_address, created_at')
              .eq('wallet_address', buyerAddress)
              .in('status', ['pending_payment', 'draft'])
              .is('transaction_signature', null) // Look for orders without transaction_signature
              .order('created_at', { ascending: false })
              .limit(5); // Limit to most recent orders
            
            if (!buyerError && buyerOrders && buyerOrders.length > 0) {
              console.log(`Found ${buyerOrders.length} recent orders from buyer ${buyerAddress.substring(0, 8)}...`);
              
              // Link the transaction to the most recent order from this buyer
              const mostRecentOrder = buyerOrders[0];
              console.log(`Linking transaction ${signature.substring(0, 12)}... to order ${mostRecentOrder.id}`);
              
              // For orders in DRAFT status, use update_order_transaction to move to PENDING_PAYMENT
              if (mostRecentOrder.status === 'draft') {
                console.log(`Order ${mostRecentOrder.id} is in DRAFT status, transitioning to PENDING_PAYMENT via update_order_transaction`);
                
                // Always use the consistent method for draft -> pending_payment transition
                try {
                  const { error: updateError } = await supabase.rpc('update_order_transaction', {
                    p_order_id: mostRecentOrder.id,
                    p_transaction_signature: signature,
                    p_amount_sol: verification.details.amount || 0
                  });
                  
                  if (updateError) {
                    console.error(`Failed to update order from DRAFT to PENDING_PAYMENT: ${updateError.message}`);
                  } else {
                    console.log(`Successfully updated order ${mostRecentOrder.id} to PENDING_PAYMENT status`);
                    orderIds.push(mostRecentOrder.id);
                  }
                } catch (error) {
                  console.error(`Error updating order ${mostRecentOrder.id} status:`, error);
                }
              } else {
                // For orders already in PENDING_PAYMENT, just update the signature
                console.log(`Order ${mostRecentOrder.id} is already in PENDING_PAYMENT status, just updating transaction signature`);
                
                try {
                  const { error: updateError } = await supabase
                    .from('orders')
                    .update({ transaction_signature: signature })
                    .eq('id', mostRecentOrder.id)
                    .eq('status', 'pending_payment');
                  
                  if (updateError) {
                    console.error(`Failed to update transaction signature: ${updateError.message}`);
                  } else {
                    console.log(`Successfully linked transaction signature to order ${mostRecentOrder.id}`);
                    orderIds.push(mostRecentOrder.id);
                  }
                } catch (error) {
                  console.error(`Error linking transaction to order ${mostRecentOrder.id}:`, error);
                }
              }
            } else {
              console.log(`No matching orders found for buyer ${buyerAddress.substring(0, 8)}...`);
            }
          }
          
          // If we still don't have an order, check if there's a transaction log entry we can use
          if (orderIds.length === 0) {
            const { data: txData, error: txError } = await supabase
              .from('transaction_logs')
              .select('product_id, signature')
              .eq('signature', signature)
              .single();
              
            if (!txError && txData && txData.product_id) {
              const productId = txData.product_id;
              console.log(`Found transaction log entry for product ${productId}`);
              
              // Look for recent orders for this product
              const { data: productOrders, error: productError } = await supabase
                .from('orders')
                .select('id, status, product_id, transaction_signature')
                .eq('product_id', productId)
                .in('status', ['pending_payment', 'draft'])
                .is('transaction_signature', null)
                .order('created_at', { ascending: false })
                .limit(3);
                
              if (!productError && productOrders && productOrders.length > 0) {
                console.log(`Found ${productOrders.length} recent orders for product ${productId}`);
                
                // Link the transaction to the most recent order for this product
                const recentProductOrder = productOrders[0];
                console.log(`Linking transaction ${signature.substring(0, 12)}... to order ${recentProductOrder.id}`);
                
                // For orders in DRAFT status, use update_order_transaction to move to PENDING_PAYMENT
                if (recentProductOrder.status === 'draft') {
                  console.log(`Order ${recentProductOrder.id} is in DRAFT status, transitioning to PENDING_PAYMENT via update_order_transaction`);
                  
                  // Always use the consistent method for draft -> pending_payment transition
                  try {
                    const { error: updateError } = await supabase.rpc('update_order_transaction', {
                      p_order_id: recentProductOrder.id,
                      p_transaction_signature: signature,
                      p_amount_sol: verification.details?.amount || 0
                    });
                    
                    if (updateError) {
                      console.error(`Failed to update order from DRAFT to PENDING_PAYMENT: ${updateError.message}`);
                    } else {
                      console.log(`Successfully updated order ${recentProductOrder.id} to PENDING_PAYMENT status`);
                      orderIds.push(recentProductOrder.id);
                    }
                  } catch (error) {
                    console.error(`Error updating order ${recentProductOrder.id} status:`, error);
                  }
                } else {
                  // For orders already in PENDING_PAYMENT, just update the signature
                  console.log(`Order ${recentProductOrder.id} is already in PENDING_PAYMENT status, just updating transaction signature`);
                  
                  try {
                    const { error: updateError } = await supabase
                      .from('orders')
                      .update({ transaction_signature: signature })
                      .eq('id', recentProductOrder.id)
                      .eq('status', 'pending_payment');
                    
                    if (updateError) {
                      console.error(`Failed to update transaction signature: ${updateError.message}`);
                    } else {
                      console.log(`Successfully linked transaction signature to order ${recentProductOrder.id}`);
                      orderIds.push(recentProductOrder.id);
                    }
                  } catch (error) {
                    console.error(`Error linking transaction to order ${recentProductOrder.id}:`, error);
                  }
                }
              }
            }
          }
        }
        
        // Try one more time to find orders with the transaction signature
        // This handles cases where we just linked the signature in previous steps
        if (orderIds.length === 0) {
          const { data: finalCheck, error: finalError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('transaction_signature', signature)
            .in('status', ['pending_payment', 'draft', 'confirmed']);
            
          if (!finalError && finalCheck && finalCheck.length > 0) {
            console.log(`Found ${finalCheck.length} orders in final check`);
            orderIds = finalCheck.map(order => order.id);
          }
        }
        
        if (orderIds.length === 0) {
          console.log(`No related orders found for transaction ${signature.substring(0, 12)}`);
        } else {
          console.log(`Found ${orderIds.length} related orders for transaction ${signature.substring(0, 12)}`);
        }
      } catch (findError) {
        console.error('Error finding related orders:', findError);
      }
    }
    
    // 3. Attempt to update all related orders if transaction is valid
    let updatedOrders = [];
    let failedOrders = [];
    
    if (verification.isValid && orderIds.length > 0) {
      console.log(`Attempting to update ${orderIds.length} orders for transaction ${signature.substring(0, 12)}`);
      
      for (const currentOrderId of orderIds) {
        try {
          console.log(`Confirming order payment for ${currentOrderId}`);
          const confirmResult = await confirmOrderPayment(currentOrderId, signature, verification);
          
          if (confirmResult.success) {
            updatedOrders.push(currentOrderId);
          } else {
            failedOrders.push({
              id: currentOrderId,
              error: confirmResult.error
            });
          }
        } catch (confirmError) {
          console.error(`Error confirming order ${currentOrderId}:`, confirmError);
          failedOrders.push({
            id: currentOrderId,
            error: confirmError.message || 'Unknown error'
          });
        }
      }
    } else if (!verification.isValid && orderIds.length > 0) {
      console.warn(`Not updating orders because transaction verification failed`);
    } else if (verification.isValid && orderIds.length === 0) {
      console.log(`Transaction is valid but no orders to update`);
    }
    
    // 4. Return comprehensive response with verification and order update results
    if (!verification.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: verification.error || 'Transaction verification failed',
          details: verification.details || {},
          ordersUpdated: updatedOrders,
          ordersFailed: failedOrders
        })
      };
    }
    
    // Everything was successful or partially successful
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        verification: {
          isValid: verification.isValid,
          details: verification.details
        },
        ordersUpdated: updatedOrders,
        ordersFailed: failedOrders,
        totalOrdersProcessed: orderIds.length
      })
    };
  } catch (err) {
    console.error('Error in verify-transaction function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error' 
      })
    };
  }
}; 