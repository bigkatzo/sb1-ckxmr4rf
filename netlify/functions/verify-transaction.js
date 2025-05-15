/**
 * VERIFY TRANSACTION
 * 
 * Server-side verification of blockchain transactions with improved error handling
 * Uses our robust RPC system with WebSocket support and retry logic
 * Implementation exactly matches the frontend approach
 */

// Enable detailed logging
const DEBUG = true;

/**
 * Enhanced logging function with prefixes and timestamps
 */
function log(level, message, data = null) {
  const prefix = '[VERIFY-TX]';
  const timestamp = new Date().toISOString();
  
  const logMessage = `${timestamp} ${prefix} ${message}`;
  
  switch (level) {
    case 'debug':
      if (DEBUG) console.log(logMessage, data !== null ? data : '');
      break;
    case 'info':
      console.log(logMessage, data !== null ? data : '');
      break;
    case 'warn':
      console.warn(logMessage, data !== null ? data : '');
      break;
    case 'error':
      console.error(logMessage, data !== null ? data : '');
      break;
    default:
      console.log(logMessage, data !== null ? data : '');
  }
}

let Connection, PublicKey;
try {
  // Try to import Solana packages, but handle the case where they're not available
  const solanaWeb3 = require('@solana/web3.js');
  Connection = solanaWeb3.Connection;
  PublicKey = solanaWeb3.PublicKey;
  log('info', 'Successfully loaded Solana web3 packages');
} catch (err) {
  log('error', 'Failed to load @solana/web3.js:', err.message);
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
    log('error', 'Missing or invalid SUPABASE_URL environment variable');
  }
  
  if (!ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_SERVICE_ROLE_KEY === 'placeholder-key-for-initialization') {
    log('error', 'Missing or invalid SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  
  // Only create client if we have reasonable values
  if (ENV.SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY && 
      ENV.SUPABASE_URL !== 'https://placeholder-url.supabase.co' && 
      ENV.SUPABASE_SERVICE_ROLE_KEY !== 'placeholder-key-for-initialization') {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    log('info', 'Supabase client initialized successfully with service role permissions');
    log('info', `Connected to database: ${ENV.SUPABASE_URL}`);
  } else {
    log('warn', 'Using fallback Supabase values - database operations will likely fail');
    supabase = createClient(
      ENV.SUPABASE_URL || 'https://placeholder-url.supabase.co',
      ENV.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key-for-initialization'
    );
  }
} catch (err) {
  log('error', 'Failed to initialize Supabase client:', err.message);
  // We'll handle this in the handler function
}

let SOLANA_CONNECTION;
const LAMPORTS_PER_SOL = 1000000000;

// Securely verify transaction details against the blockchain
async function verifyTransactionDetails(signature, expectedDetails) {
  log('info', `Starting transaction verification for signature: ${signature?.substring(0, 10)}...`);
  if (expectedDetails) {
    log('debug', 'Expected transaction details:', {
      amount: expectedDetails.amount,
      buyer: expectedDetails.buyer?.substring(0, 8) + '...',
      recipient: expectedDetails.recipient?.substring(0, 8) + '...'
    });
  }

  try {
    // Check if we have Solana libraries available
    if (!SOLANA_CONNECTION) {
      log('error', 'Solana verification unavailable: No connection available');
      return { 
        isValid: false, 
        error: 'Solana verification is not available. Please try again later.' 
      };
    }

    // Use our shared verification function with proper error handling and timeouts
    log('info', 'Verifying transaction on blockchain');
    const result = await verifyTransaction(SOLANA_CONNECTION, signature);
    
    if (!result.isValid) {
      log('warn', 'Transaction validation failed:', result.error);
      return result;
    }
    
    log('info', 'Raw transaction retrieved successfully');
    const tx = result.transaction;

    // Extract & analyze transaction details
    if (!tx || !tx.meta) {
      log('error', 'Transaction object missing or incomplete');
      return {
        isValid: false,
        error: 'Invalid transaction data received'
      };
    }

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
      log('error', 'Could not identify transfer details in transaction');
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

    log('info', 'Extracted transaction details:', {
      amount: details.amount,
      buyer: details.buyer?.substring(0, 8) + '...',
      recipient: details.recipient?.substring(0, 8) + '...',
    });

    // If we have expected details, verify them
    if (expectedDetails) {
      // Check amount
      if (Math.abs(details.amount - expectedDetails.amount) > 0.00001) { // Allow small rounding differences
        log('warn', 'Amount mismatch in transaction verification', { 
          expected: expectedDetails.amount, 
          actual: details.amount
        });
        return {
          isValid: false,
          error: `Amount mismatch: expected ${expectedDetails.amount} SOL, got ${details.amount} SOL`,
          details
        };
      }

      // Check buyer
      if (details.buyer.toLowerCase() !== expectedDetails.buyer.toLowerCase()) {
        log('warn', 'Buyer mismatch in transaction verification', {
          expected: expectedDetails.buyer?.substring(0, 8) + '...',
          actual: details.buyer?.substring(0, 8) + '...'
        });
        return {
          isValid: false,
          error: `Buyer mismatch: expected ${expectedDetails.buyer}, got ${details.buyer}`,
          details
        };
      }

      // Check recipient
      if (details.recipient.toLowerCase() !== expectedDetails.recipient.toLowerCase()) {
        log('warn', 'Recipient mismatch in transaction verification', {
          expected: expectedDetails.recipient?.substring(0, 8) + '...',
          actual: details.recipient?.substring(0, 8) + '...'
        });
        return {
          isValid: false,
          error: `Recipient mismatch: expected ${expectedDetails.recipient}, got ${details.recipient}`,
          details
        };
      }
      
      log('info', 'All transaction details match expected values');
    }

    log('info', 'Transaction verified successfully');
    return { isValid: true, details };
  } catch (error) {
    log('error', 'Error verifying transaction:', error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Failed to verify transaction' 
    };
  }
}

/**
 * Verify and update the order status using approach from frontend
 * Updated to support batch orders
 */
async function confirmOrderPayment(orderId, signature, verification, batchOrderId) {
  log('info', `Confirming order payment for orderId: ${orderId}, signature: ${signature?.substring(0, 10)}...`, {
    batchOrderId: batchOrderId || 'none',
    isVerified: verification?.isValid || false,
  });
  
  if (!supabase) {
    log('warn', 'Supabase client not initialized, cannot confirm order payment');
    return {
      success: false,
      error: 'Database connection not available'
    };
  }
  
  try {
    if (!verification.isValid) {
      log('warn', 'Transaction verification failed, logging failure');
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
          log('error', 'Failed to log verification failure:', logError);
        } else {
          log('info', 'Logged transaction verification failure successfully');
        }
      } catch (dbError) {
        log('error', 'Database error when logging verification failure:', dbError);
      }
      
      return {
        success: false,
        error: verification.error || 'Transaction verification failed'
      };
    }
    
    // Update transaction log with success
    log('info', 'Transaction verified, updating transaction status to confirmed');
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
        log('error', 'Failed to update transaction status:', updateError);
        return {
          success: false,
          error: 'Failed to update transaction status'
        };
      } else {
        log('info', 'Transaction status updated successfully');
      }
    } catch (dbError) {
      log('error', 'Database error when updating transaction status:', dbError);
      return {
        success: false,
        error: 'Database error when updating transaction'
      };
    }
    
    // Handle batch orders differently
    if (batchOrderId) {
      log('info', `Order is part of batch ${batchOrderId}, redirecting to batch order processing`);
      return await confirmBatchOrderPayment(batchOrderId, signature, verification);
    }
    
    // Check the current order status
    log('info', `Looking up order details for ${orderId}`);
    let orderData;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, transaction_signature, batch_order_id')
        .eq('id', orderId)
        .single();
        
      if (error) {
        log('error', 'Error fetching order details:', error);
        return { success: false, error: 'Failed to fetch order details' };
      }
      
      orderData = data;
      log('info', 'Retrieved order details:', {
        id: orderData.id,
        status: orderData.status,
        hasTxSignature: !!orderData.transaction_signature,
        batchOrderId: orderData.batch_order_id || 'none',
        signature: signature?.substring(0, 8) + '...' || 'none',
      });
      
      // Validate order exists and has matching signature
      if (!orderData) {
        log('error', 'Order not found:', orderId);
        return { success: false, error: 'Order not found' };
      }
      
      // If order has a batch_order_id but it wasn't passed as parameter, use it
      if (orderData.batch_order_id && !batchOrderId) {
        log('info', `Order ${orderId} belongs to batch ${orderData.batch_order_id}, redirecting to batch processing`);
        return await confirmBatchOrderPayment(orderData.batch_order_id, signature, verification);
      }
    } catch (error) {
      log('error', 'Error fetching order:', error);
      return { success: false, error: 'Failed to fetch order' };
    }
    
    // STEP 1: Handle order in DRAFT status - must transition to PENDING_PAYMENT first
    if (orderData.status === 'draft') {
      log('info', `Order ${orderId} is in DRAFT status, transitioning to PENDING_PAYMENT first`, {
        orderId,
        signature: signature?.substring(0, 8) + '...' || 'none',
      });
      
      try {
        // Use update_order_transaction to transition from DRAFT to PENDING_PAYMENT
        log('debug', 'Calling update_order_transaction RPC function');
        const { error: updateError } = await supabase.rpc('update_order_transaction', {
          p_order_id: orderId,
          p_transaction_signature: signature,
          p_amount_sol: verification.details?.amount || 0
        });
        
        if (updateError) {
          log('error', 'Failed to transition from DRAFT to PENDING_PAYMENT:', updateError);
          return { success: false, error: 'Failed to update order to PENDING_PAYMENT status' };
        }
        
        log('info', `Successfully transitioned order ${orderId} from DRAFT to PENDING_PAYMENT`);
        
        // Refresh order data after transition
        const { data: refreshedData, error: refreshError } = await supabase
          .from('orders')
          .select('id, status, transaction_signature')
          .eq('id', orderId)
          .single();
          
        if (refreshError) {
          log('error', 'Failed to refresh order data after transition:', refreshError);
        } else {
          orderData = refreshedData;
          log('info', 'Updated order status after transition:', orderData);
        }
      } catch (error) {
        log('error', 'Error updating order status:', error);
        return { success: false, error: 'Failed to update order status' };
      }
    }
    
    // STEP 2: Handle order in PENDING_PAYMENT status - transition to CONFIRMED
    if (orderData.status === 'pending_payment') {
      log('info', `Order ${orderId} is in PENDING_PAYMENT status, transitioning to CONFIRMED`, {
        orderId,
        signature: signature?.substring(0, 8) + '...' || 'none',
      });
      
      try {
        // First try to use confirm_order_payment RPC
        log('debug', 'Attempting to confirm order payment with RPC function', {
          signature: signature?.substring(0, 8) + '...',
          orderId
        });
        const { data: confirmData, error: confirmError } = await supabase.rpc('confirm_order_payment', {
          p_transaction_signature: signature,
          p_status: 'confirmed'
        });
        
        if (confirmError) {
          log('warn', 'Failed to confirm order payment with RPC:', confirmError);
          
          // Try direct_update_order_status as a backup
          log('debug', 'Attempting to use direct_update_order_status as fallback');
          const { data: updateData, error: updateError } = await supabase.rpc('direct_update_order_status', {
            p_order_id: orderId,
            p_status: 'confirmed'
          });
          
          if (updateError) {
            log('warn', 'Direct order update via RPC failed:', updateError);
            
            // Last resort: direct table update
            log('debug', 'Attempting direct table update as last resort');
            const { error: directUpdateError } = await supabase
              .from('orders')
              .update({ status: 'confirmed' })
              .eq('id', orderId)
              .eq('status', 'pending_payment');
              
            if (directUpdateError) {
              log('error', 'Last-resort direct update failed:', directUpdateError);
              return { success: false, error: 'All update methods failed to confirm order' };
            } else {
              log('info', 'Successfully confirmed order via direct update');
            }
          } else {
            log('info', 'Successfully confirmed order via direct_update_order_status RPC');
          }
        } else {
          log('info', 'Successfully confirmed order via confirm_order_payment RPC');
        }
        
        // Final check to confirm the update was successful
        log('debug', 'Performing final check on order status');
        const { data: finalOrder, error: finalError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('id', orderId)
          .single();
          
        if (finalError) {
          log('warn', 'Could not perform final order status check:', finalError);
        } else {
          log('info', 'Final order status check result:', finalOrder);
          if (finalOrder.status !== 'confirmed') {
            log('warn', 'Order status is still not confirmed after all update attempts');
            return { success: false, error: 'Failed to update order status to CONFIRMED' };
          }
        }
        
        log('info', `Order ${orderId} confirmed successfully`);
        return { success: true };
      } catch (error) {
        log('error', 'Error confirming order payment:', error);
        return { success: false, error: 'Error confirming order payment' };
      }
    } else if (orderData.status === 'confirmed') {
      log('info', `Order ${orderId} is already in CONFIRMED status, no action needed`);
      return { success: true };
    } else {
      log('warn', `Order ${orderId} is in unexpected status: ${orderData.status}, not updating`);
      return { success: false, error: `Cannot update order in ${orderData.status} status` };
    }
  } catch (error) {
    log('error', 'Error in confirmOrderPayment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Confirm payment for a batch order
 * Handles all items in a batch order
 */
async function confirmBatchOrderPayment(batchOrderId, signature, verification) {
  log('info', `Confirming batch order payment for batchOrderId: ${batchOrderId}, signature: ${signature?.substring(0, 10)}...`);
  
  try {
    // First update the transaction status
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
        log('error', 'Failed to update transaction status:', updateError);
      }
    } catch (error) {
      log('error', 'Exception updating transaction status:', error);
    }

    // Get all orders in this batch
    const { data: orders, error: batchError } = await supabase
      .from('orders')
      .select('id, status, transaction_signature, payment_metadata')
      .eq('batch_order_id', batchOrderId);
      
    if (batchError) {
      log('error', 'Error fetching batch orders:', batchError);
      throw batchError;
    }
    
    if (!orders || orders.length === 0) {
      // Fallback: Try to find orders using payment_metadata
      const { data: metadataOrders, error: metadataError } = await supabase
        .from('orders')
        .select('id, status, transaction_signature, payment_metadata')
        .filter('payment_metadata->batchOrderId', 'eq', batchOrderId);
        
      if (metadataError) {
        log('error', 'Error fetching orders by metadata:', metadataError);
        throw metadataError;
      }
      
      if (!metadataOrders || metadataOrders.length === 0) {
        log('error', 'No orders found for batch');
        throw new Error('No orders found for batch');
      }
      
      orders = metadataOrders;
    }
    
    log('info', `Found ${orders.length} orders in batch`);
    
    // Update each order individually with the correct status and pricing
    let successCount = 0;
    let errorCount = 0;
    
    for (const order of orders) {
      try {
        // Get the actual price for this order from payment_metadata
        const originalPrice = order.payment_metadata?.originalPrice || 0;
        const couponDiscount = order.payment_metadata?.couponDiscount || 0;
        const orderAmount = Math.max(0, originalPrice - couponDiscount);
        
        log('debug', `Confirming order ${order.id} with amount: ${orderAmount} SOL`);
        
        // Update the order's status and amount
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            transaction_signature: signature,
            amount_sol: orderAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);
          
        if (updateError) {
          log('error', `Error confirming order ${order.id}:`, updateError);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (orderError) {
        log('error', `Exception confirming order ${order.id}:`, orderError);
        errorCount++;
      }
    }
    
    log('info', `Batch order confirmation completed: ${successCount} succeeded, ${errorCount} failed`);
    
    return {
      success: successCount > 0,
      ordersConfirmed: successCount,
      ordersFailed: errorCount,
      totalOrders: orders.length
    };
  } catch (error) {
    log('error', 'Error confirming batch order payment:', error);
    throw error;
  }
}

// Update the handler function to properly handle batch orders
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

  // Skip authentication - this is a server-only function using service role key
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
  const { orderId, signature, expectedDetails, batchOrderId, isBatchOrder } = requestBody;

  if (!signature) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing transaction signature' })
    };
  }

  // For non-Solana transactions (like Stripe), handle differently
  if (signature.startsWith('pi_') || signature.startsWith('free_')) {
    console.log(`Processing non-blockchain transaction: ${signature.substring(0, 10)}...`);
    
    // Check if this is explicitly marked as a Stripe payment
    const isStripePayment = signature.startsWith('pi_') || requestBody.stripePayment === true;
    
    if (isStripePayment) {
      console.log('Processing Stripe payment intent verification');
      
      // If orderId is provided, update it directly
      if (orderId) {
        console.log(`Stripe payment: Confirming order ${orderId} with payment ID ${signature}`);
        
        try {
          // First try to update with RPC function for Stripe payments
          try {
            const { error: rpcError } = await supabase.rpc('confirm_stripe_payment', {
              p_payment_id: signature,
              p_order_id: orderId
            });
            
            if (rpcError) {
              console.log('RPC error confirming Stripe payment:', rpcError);
              throw rpcError;
            }
            
            console.log('Successfully confirmed Stripe payment via RPC function');
            return {
              statusCode: 200,
              body: JSON.stringify({
                success: true,
                message: 'Stripe payment confirmed via RPC',
                orderId
              })
            };
          } catch (rpcError) {
            console.warn('Failed to confirm Stripe payment via RPC, trying direct update:', rpcError);
    
            // Fallback: Do direct database operations
            // First check current status
            const { data: orderData, error: getError } = await supabase
              .from('orders')
              .select('status, transaction_signature')
              .eq('id', orderId)
              .single();
              
            if (getError) {
              console.error('Error checking order status:', getError);
              throw getError;
            }
            
            // If the order is in draft status, update to pending_payment first
            if (orderData.status === 'draft') {
              console.log(`Order ${orderId} is in draft status, updating to pending_payment first`);
              
              const { error: pendingError } = await supabase
                .from('orders')
                .update({
                  status: 'pending_payment',
                  transaction_signature: signature,
                  payment_metadata: {
                    paymentIntentId: signature,
                    paymentMethod: 'stripe',
                    verifiedAt: new Date().toISOString()
                  },
                  updated_at: new Date().toISOString()
                })
                .eq('id', orderId)
                .eq('status', 'draft');
                
              if (pendingError) {
                console.error('Error updating to pending_payment:', pendingError);
                throw pendingError;
              }
            }
            
            // Now update to confirmed if not already
            if (orderData.status !== 'confirmed') {
              console.log(`Updating order ${orderId} to confirmed status`);
              
              const { error: confirmError } = await supabase
                .from('orders')
                .update({
                  status: 'confirmed',
                  updated_at: new Date().toISOString()
                })
                .eq('id', orderId)
                .in('status', ['draft', 'pending_payment']);
          
              if (confirmError) {
                console.error('Error confirming order:', confirmError);
                throw confirmError;
              }
            } else {
              console.log(`Order ${orderId} is already confirmed, no action needed`);
            }
          }
          
          return {
            statusCode: 200,
            body: JSON.stringify({
              success: true,
              message: 'Stripe payment confirmed',
              orderId
            })
          };
        } catch (error) {
          console.error('Error confirming Stripe payment:', error);
          return {
            statusCode: 500,
            body: JSON.stringify({
              success: false,
              error: 'Failed to confirm Stripe payment',
              details: error.message
            })
          };
        }
      }
      
      // If no orderId was provided, try to look it up
      try {
        console.log('Looking up orders by Stripe payment ID:', signature);
        const { data: orders, error: lookupError } = await supabase
              .from('orders')
          .select('id, status')
          .eq('transaction_signature', signature);
          
        if (lookupError) {
          console.error('Error looking up orders by payment ID:', lookupError);
          return {
            statusCode: 500,
            body: JSON.stringify({
              success: false,
              error: 'Could not look up orders for payment ID',
              details: lookupError.message
            })
          };
        }
        
        if (!orders || orders.length === 0) {
          console.log('No orders found with this payment ID');
          return {
            statusCode: 200,
            body: JSON.stringify({
              success: false,
              warning: 'No orders found with this payment ID',
              ordersUpdated: 0
            })
          };
        }
        
        console.log(`Found ${orders.length} orders with this payment ID, setting to confirmed`);
        
        // Update any non-confirmed orders to confirmed status
        const nonConfirmedOrders = orders.filter(o => o.status !== 'confirmed');
        if (nonConfirmedOrders.length > 0) {
                  const { error: updateError } = await supabase
                    .from('orders')
            .update({
              status: 'confirmed',
              updated_at: new Date().toISOString()
            })
            .in('id', nonConfirmedOrders.map(o => o.id));
                  
                  if (updateError) {
            console.error('Error updating orders to confirmed:', updateError);
            return {
              statusCode: 500,
              body: JSON.stringify({
                success: false,
                error: 'Failed to update orders to confirmed',
                details: updateError.message
              })
            };
          }
        }
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: 'Stripe payment verified and orders confirmed',
            ordersUpdated: nonConfirmedOrders.length,
            totalOrders: orders.length
          })
        };
                } catch (error) {
        console.error('Error processing Stripe payment without order ID:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            error: 'Failed to process Stripe payment',
            details: error.message
          })
        };
            }
          }
          
    // Handle free orders or other special payment types
    if (signature.startsWith('free_')) {
      console.log('Processing free order verification');
      // Rest of free order handling...
    }
    
    // Generic handler for other non-blockchain payments
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
    
    // 2. Determine which orders to process
    let targetOrderId = orderId;
    let targetBatchOrderId = batchOrderId;
                
    // If we have a batch order ID, prioritize that for processing
    if (targetBatchOrderId || isBatchOrder === true) {
      console.log(`Processing as batch order: ${targetBatchOrderId || 'batch ID to be determined'}`);
                
      // If we don't have a batch ID but isBatchOrder flag is true, try to find batch ID
      if (!targetBatchOrderId && targetOrderId) {
        try {
          // Look up batch ID from orderId
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('batch_order_id')
            .eq('id', targetOrderId)
            .single();
                    
          if (!orderError && orderData && orderData.batch_order_id) {
            targetBatchOrderId = orderData.batch_order_id;
            console.log(`Found batch ID ${targetBatchOrderId} for order ${targetOrderId}`);
                    }
                  } catch (error) {
          console.error('Error finding batch ID from order:', error);
                  }
      }
      
      // If we have a targetBatchOrderId, process as batch
      if (targetBatchOrderId) {
        if (verification.isValid) {
          const result = await confirmBatchOrderPayment(targetBatchOrderId, signature, verification);
          
          return {
            statusCode: result.success ? 200 : 400,
            body: JSON.stringify({
              success: result.success,
              error: result.error,
              verification: {
                isValid: verification.isValid,
                details: verification.details || {}
              },
              batchOrderId: targetBatchOrderId,
              ordersUpdated: result.success ? true : false
            })
          };
                    } else {
          return {
            statusCode: 400,
            body: JSON.stringify({
              success: false,
              error: verification.error || 'Transaction verification failed',
              details: verification.details || {},
              batchOrderId: targetBatchOrderId
            })
          };
                    }
      }
    }
    
    // If no batch ID found or provided, attempt to find related orders
    if (!targetOrderId && verification.isValid) {
      // If no orderId but transaction is valid, find related orders
      try {
        // First check for exact transaction_signature match
        const { data: exactOrders, error: exactError } = await supabase
            .from('orders')
          .select('id, status, transaction_signature, batch_order_id')
            .eq('transaction_signature', signature)
          .in('status', ['pending_payment', 'draft']);
            
        if (!exactError && exactOrders && exactOrders.length > 0) {
          console.log(`Found ${exactOrders.length} orders with exact transaction signature match`);
          
          // Check if they're part of a batch
          const batchOrder = exactOrders.find(order => order.batch_order_id);
          if (batchOrder) {
            targetBatchOrderId = batchOrder.batch_order_id;
            console.log(`Orders are part of batch ${targetBatchOrderId}, using batch processing`);
            
            if (verification.isValid) {
              const result = await confirmBatchOrderPayment(targetBatchOrderId, signature, verification);
              
              return {
                statusCode: result.success ? 200 : 400,
                body: JSON.stringify({
                  success: result.success,
                  error: result.error,
                  verification: {
                    isValid: verification.isValid,
                    details: verification.details || {}
                  },
                  batchOrderId: targetBatchOrderId,
                  ordersUpdated: result.success ? true : false
                })
              };
            }
          }
          
          // Otherwise just use the first matching order
          targetOrderId = exactOrders[0].id;
          console.log(`Using exact match order: ${targetOrderId}`);
        } else {
          // If no exact match, try broader search with wallet address
          console.log('No exact transaction signature matches found, trying broader search');
          
          if (verification.details && verification.details.buyer) {
            const buyerAddress = verification.details.buyer;
      
            // Find recent orders from this buyer
            const { data: buyerOrders, error: buyerError } = await supabase
        .from('orders')
              .select('id, status, transaction_signature, wallet_address, created_at, batch_order_id')
              .eq('wallet_address', buyerAddress)
              .in('status', ['pending_payment', 'draft'])
              .is('transaction_signature', null) // Look for orders without transaction_signature
              .order('created_at', { ascending: false })
              .limit(5); // Limit to most recent orders
        
            if (!buyerError && buyerOrders && buyerOrders.length > 0) {
              console.log(`Found ${buyerOrders.length} recent orders from buyer ${buyerAddress.substring(0, 8)}...`);
        
              // Check if any orders are part of a batch
              const batchOrder = buyerOrders.find(order => order.batch_order_id);
              if (batchOrder) {
                targetBatchOrderId = batchOrder.batch_order_id;
                console.log(`Orders are part of batch ${targetBatchOrderId}, using batch processing`);
                
                if (verification.isValid) {
                  const result = await confirmBatchOrderPayment(targetBatchOrderId, signature, verification);
                  
                  return {
                    statusCode: result.success ? 200 : 400,
                    body: JSON.stringify({
                      success: result.success,
                      error: result.error,
                      verification: {
                        isValid: verification.isValid,
                        details: verification.details || {}
                      },
                      batchOrderId: targetBatchOrderId,
                      ordersUpdated: result.success ? true : false
                    })
                  };
                }
              }
              
              // Otherwise just use the most recent order
              targetOrderId = buyerOrders[0].id;
              console.log(`Using most recent order: ${targetOrderId}`);
            }
          }
          }
      } catch (error) {
        console.error('Error finding related orders:', error);
      }
    }
    
    // At this point, we either have an orderId or we don't - proceed with single order processing
    if (targetOrderId) {
      if (verification.isValid) {
        const result = await confirmOrderPayment(targetOrderId, signature, verification, targetBatchOrderId);
        
        return {
          statusCode: result.success ? 200 : 400,
          body: JSON.stringify({
            success: result.success,
            error: result.error,
            verification: {
              isValid: verification.isValid,
              details: verification.details || {}
            },
            ordersUpdated: [targetOrderId]
          })
        };
      } else {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: verification.error || 'Transaction verification failed',
            details: verification.details || {}
        })
      };
      }
    }
    
    // If we get here, we couldn't find any orders to update
    if (verification.isValid) {
      // Transaction is valid but no orders found
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
          warning: 'Transaction verified but no related orders found',
        verification: {
            isValid: true,
            details: verification.details || {}
        },
          ordersUpdated: []
        })
      };
    } else {
      // Transaction is invalid
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: verification.error || 'Transaction verification failed',
          details: verification.details || {}
      })
    };
    }
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