/**
 * UPDATE ORDER TRANSACTION
 * 
 * Server-side function for updating order transaction information
 * Uses service role credentials to access database functions
 * Modified to implement the same transaction flow as the original working implementation
 */

const { createClient } = require('@supabase/supabase-js');

// Enable detailed logging
const DEBUG = true;

/**
 * Enhanced logging function with prefixes and optional debug mode
 */
function log(level, message, data = null) {
  const prefix = '[UPDATE-ORDER-TX]';
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

// Environment variables
const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
};

// Initialize Supabase with service role credentials
let supabase;
try {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    log('error', 'Missing Supabase credentials in environment variables');
  } else {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    log('info', 'Supabase client initialized with service role permissions');
  }
} catch (err) {
  log('error', 'Failed to initialize Supabase client:', err.message);
}

exports.handler = async (event, context) => {
  // Enable CORS for frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    log('warn', 'Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check if Supabase client is available
  if (!supabase) {
    log('error', 'Database connection unavailable');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Database connection unavailable' })
    };
  }

  // Parse request body
  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
    log('info', 'Received update request:', {
      ...requestBody,
      // Only show part of the signature for security
      transactionSignature: requestBody.transactionSignature 
        ? `${requestBody.transactionSignature.substring(0, 8)}...${requestBody.transactionSignature.slice(-8)}` 
        : 'none'
    });
  } catch (err) {
    log('error', 'Invalid request body:', event.body);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  // Extract transaction details from request
  const { 
    orderId, 
    transactionSignature, 
    amountSol,
    batchOrderId, // Add support for batch order ID
    isBatchOrder // Flag to indicate if this is a batch order
  } = requestBody;

  log('debug', 'Extracted request parameters', {
    orderId: orderId || 'not provided',
    transactionSignaturePrefix: transactionSignature 
      ? `${transactionSignature.substring(0, 8)}...` 
      : 'not provided',
    amountSol: amountSol || 'not provided',
    batchOrderId: batchOrderId || 'not provided',
    isBatchOrder: isBatchOrder || false
  });

  // First attempt recovery if orderId is missing
  let targetOrderId = orderId;
  let targetBatchOrderId = batchOrderId;

  if (!targetOrderId) {
    log('warn', 'Missing orderId in request, attempting recovery');
    
    // Only try recovery if we have a transaction signature
    if (!transactionSignature) {
      log('error', 'Missing both transaction signature and order ID');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing transaction signature and order ID' })
      };
    }
    
    try {
      // Try to find the most recent order with the wallet address
      if (requestBody.walletAddress) {
        log('info', 'Attempting to find order for wallet:', requestBody.walletAddress);
        
        // Look for recent draft orders from this wallet
        const { data: recentOrders, error: recentError } = await supabase
          .from('orders')
          .select('id, order_number, status, batch_order_id')
          .eq('wallet_address', requestBody.walletAddress)
          .in('status', ['draft'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (recentError) {
          log('error', 'Error searching for recent orders by wallet:', recentError);
        } else if (recentOrders && recentOrders.length > 0) {
          targetOrderId = recentOrders[0].id;
          log('info', 'Recovered orderId from wallet address:', targetOrderId);
          
          // Check if this is part of a batch order
          if (recentOrders[0].batch_order_id) {
            targetBatchOrderId = recentOrders[0].batch_order_id;
            log('info', 'Recovered order is part of batch:', targetBatchOrderId);
          }
        } else {
          log('debug', 'No recent orders found for wallet:', requestBody.walletAddress);
        }
      }
      
      // If we still don't have an order ID, try to find any recent draft orders
      if (!targetOrderId) {
        log('info', 'Attempting to find any recent draft orders');
        const { data: anyOrders, error: anyError } = await supabase
          .from('orders')
          .select('id, order_number, status, batch_order_id')
          .in('status', ['draft'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (anyError) {
          log('error', 'Error searching for any recent draft orders:', anyError);
        } else if (anyOrders && anyOrders.length > 0) {
          targetOrderId = anyOrders[0].id;
          log('info', 'Recovered orderId from recent orders:', targetOrderId);
          
          // Check if this is part of a batch order
          if (anyOrders[0].batch_order_id) {
            targetBatchOrderId = anyOrders[0].batch_order_id;
            log('info', 'Recovered order is part of batch:', targetBatchOrderId);
          }
        } else {
          log('warn', 'No recent draft orders found');
        }
      }
      
      // If we still don't have an order ID, give up
      if (!targetOrderId && !targetBatchOrderId) {
        log('error', 'Missing order ID and recovery failed');
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Missing order ID and recovery failed',
            recoveryAttempted: true
          })
        };
      }
    } catch (recoveryError) {
      log('error', 'Error in order recovery:', recoveryError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing order ID and recovery failed with error',
          details: recoveryError.message
        })
      };
    }
  }

  // If targetOrderId is still null but we have targetBatchOrderId, we'll use that
  if (!targetOrderId && !targetBatchOrderId) {
    log('error', 'Missing both order ID and batch order ID');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing both order ID and batch order ID' })
    };
  }

  // Validate required parameters
  if (!transactionSignature) {
    log('error', 'Missing transaction signature');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing transaction signature' })
    };
  }

  if (amountSol === undefined || amountSol === null) {
    log('error', 'Missing amount in SOL');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing amount in SOL' })
    };
  }

  const amountSolFloat = parseFloat(amountSol || 0);
  // Check if this is a free order (transaction signature starts with 'free_')
  const isFreeOrder = transactionSignature && transactionSignature.startsWith('free_');
  
  log('info', 'Processing parameters:', {
    targetOrderId: targetOrderId || 'not found',
    targetBatchOrderId: targetBatchOrderId || 'not found',
    transactionSignaturePrefix: transactionSignature.substring(0, 8) + '...',
    amountSol: amountSolFloat,
    isFreeOrder
  });

  // If we have a batch order ID, use it for updating all related orders
  if (targetBatchOrderId || (targetOrderId && isBatchOrder === true)) {
    if (!targetBatchOrderId && targetOrderId) {
      // If we don't have batch ID but isBatchOrder is true, try to find batch ID from order ID
      log('info', 'isBatchOrder is true but no batchOrderId, looking up from orderId');
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('batch_order_id')
          .eq('id', targetOrderId)
          .single();

        if (error) {
          log('error', 'Error getting batch ID from order:', error);
        } else if (data && data.batch_order_id) {
          targetBatchOrderId = data.batch_order_id;
          log('info', `Found batch ID ${targetBatchOrderId} for order ${targetOrderId}`);
        } else {
          log('warn', `No batch ID found for order ${targetOrderId}`);
        }
      } catch (error) {
        log('error', 'Exception getting batch ID from order:', error);
      }
    }

    if (targetBatchOrderId) {
      log('info', `Processing batch order transaction update for batch: ${targetBatchOrderId}`, {
        transactionSignature: transactionSignature ? `${transactionSignature.substring(0, 8)}...` : 'none',
        amountSol: amountSolFloat,
        isFreeOrder
      });

      try {
        // Get all orders in this batch with status 'draft'
        const { data: batchOrders, error: batchError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('batch_order_id', targetBatchOrderId)
          .in('status', ['draft']);

        if (batchError) {
          log('error', 'Error fetching batch orders:', batchError);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch batch orders' })
          };
        }

        if (!batchOrders || batchOrders.length === 0) {
          log('warn', 'No draft orders found in batch');
          // Try looking for pending_payment orders in case they were already updated
          const { data: pendingOrders, error: pendingError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('batch_order_id', targetBatchOrderId)
            .in('status', ['pending_payment']);

          if (pendingError) {
            log('error', 'Error fetching pending orders:', pendingError);
          } else if (pendingOrders && pendingOrders.length > 0) {
            log('info', `Found ${pendingOrders.length} orders in pending_payment status`);
            
            // If orders are already in pending_payment status, try to update the first one
            // with the transaction signature, which is consistent with the original implementation
            if (pendingOrders.length > 0) {
              const firstPendingOrderId = pendingOrders[0].id;
              log('info', `Updating first pending order ${firstPendingOrderId} with transaction signature`);
              
              const { error: updateError } = await supabase
                .from('orders')
                .update({
                  transaction_signature: transactionSignature,
                  amount_sol: amountSolFloat / pendingOrders.length,
                  updated_at: new Date().toISOString()
                })
                .eq('id', firstPendingOrderId);
              
              if (updateError) {
                log('error', 'Error updating first pending order:', updateError);
                return {
                  statusCode: 400,
                  headers,
                  body: JSON.stringify({ 
                    error: 'Failed to update transaction signature for pending order',
                    details: updateError.message
                  })
                };
              } else {
                log('info', `Successfully updated transaction signature for first pending order ${firstPendingOrderId}`);
              }
              
              // For free orders, transition all orders to confirmed status
              if (isFreeOrder) {
                const allPendingOrderIds = pendingOrders.map(order => order.id);
                log('info', `Auto-confirming ${allPendingOrderIds.length} free orders in batch`);
                
                const { error: confirmError } = await supabase
                  .from('orders')
                  .update({
                    status: 'confirmed',
                    updated_at: new Date().toISOString()
                  })
                  .in('id', allPendingOrderIds);
                
                if (confirmError) {
                  log('error', 'Error confirming free batch orders:', confirmError);
                } else {
                  log('info', 'Free batch orders confirmed successfully');
                }
              }
              
              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                  success: true, 
                  data: { 
                    batchOrderId: targetBatchOrderId,
                    transactionSignature, 
                    amountSol: amountSolFloat,
                    isBatchOrder: true,
                    ordersUpdated: pendingOrders.length
                  } 
                })
              };
            }
          } else {
            log('warn', 'No pending_payment orders found in batch either');
          }
          
          // Return a more specific error if we couldn't find any orders to update
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'No draft or pending orders found in batch',
              batchOrderId: targetBatchOrderId
            })
          };
        }

        log('info', `Found ${batchOrders.length} draft orders in batch ${targetBatchOrderId}`);

        // First, update just one order with the transaction signature - similar to original implementation
        // This is to avoid transaction signature duplication issues
        const firstOrderId = batchOrders[0].id;
        
        log('info', `Updating first order ${firstOrderId} with transaction signature using RPC function`);
        // Update the first order using the update_order_transaction RPC function (same as original implementation)
        const { error: updateError } = await supabase.rpc('update_order_transaction', {
          p_order_id: firstOrderId,
          p_transaction_signature: transactionSignature,
          p_amount_sol: amountSolFloat
        });

        if (updateError) {
          log('error', 'Error updating transaction for first order in batch:', updateError);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Failed to update transaction signature for first order in batch',
              details: updateError.message
            })
          };
        }

        log('info', `Successfully updated transaction signature for first order ${firstOrderId}`);

        // Then update the remaining orders directly, without setting the transaction signature
        // to avoid unique constraint violations. Move them to pending_payment status.
        if (batchOrders.length > 1) {
          const otherOrderIds = batchOrders.slice(1).map(order => order.id);
          
          log('info', `Updating ${otherOrderIds.length} remaining orders to pending_payment status`);
          const { error: bulkUpdateError } = await supabase
            .from('orders')
            .update({
              status: 'pending_payment',
              amount_sol: amountSolFloat / batchOrders.length,
              updated_at: new Date().toISOString()
            })
            .in('id', otherOrderIds);
          
          if (bulkUpdateError) {
            log('error', 'Error updating remaining orders in batch:', bulkUpdateError);
            // Don't fail the entire operation if the main order was updated
          } else {
            log('info', `Successfully updated ${otherOrderIds.length} remaining orders to pending_payment status`);
          }
        }

        // For free orders, confirm all orders in the batch
        if (isFreeOrder) {
          // Get all orders in this batch
          const allOrderIds = batchOrders.map(order => order.id);
          
          log('info', `Auto-confirming ${allOrderIds.length} free orders in batch`);
          const { error: confirmError } = await supabase
            .from('orders')
            .update({
              status: 'confirmed',
              updated_at: new Date().toISOString()
            })
            .in('id', allOrderIds);
          
          if (confirmError) {
            log('error', 'Error confirming free batch orders:', confirmError);
          } else {
            log('info', 'Free batch orders confirmed successfully');
          }
        }

        log('info', `Batch order transaction update completed successfully for batch ${targetBatchOrderId}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            data: { 
              batchOrderId: targetBatchOrderId,
              transactionSignature, 
              amountSol: amountSolFloat,
              isBatchOrder: true,
              ordersUpdated: batchOrders.length
            } 
          })
        };
      } catch (error) {
        log('error', 'Error in batch order transaction update:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Internal server error during batch order update',
            details: error.message
          })
        };
      }
    }
  }

  // If we don't have a batch order ID or couldn't find one, fall back to updating a single order
  if (targetOrderId) {
    log('info', `Updating single order transaction for order: ${targetOrderId}`, {
      transactionSignature: transactionSignature ? `${transactionSignature.substring(0, 8)}...` : 'none',
      amountSol: amountSolFloat,
      isFreeOrder
    });

    try {
      // Use the update_order_transaction RPC function directly - same as original implementation
      log('debug', 'Calling update_order_transaction RPC function');
      const { error: updateError } = await supabase.rpc('update_order_transaction', {
        p_order_id: targetOrderId,
        p_transaction_signature: transactionSignature,
        p_amount_sol: amountSolFloat
      });

      if (updateError) {
        log('error', 'Error updating order transaction:', updateError);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: updateError.message })
        };
      }
      
      log('info', `Successfully updated transaction for order ${targetOrderId}`);
      
      // For free orders, automatically confirm the transaction
      if (isFreeOrder) {
        log('info', 'Auto-confirming free order:', targetOrderId);
        
        // Confirm the order using the RPC function - same as original implementation
        const { error: confirmError } = await supabase.rpc('confirm_order_transaction', {
          p_order_id: targetOrderId
        });
        
        if (confirmError) {
          log('error', 'Error confirming free order:', confirmError);
          // Don't fail the entire request, just log the error
        } else {
          log('info', 'Free order confirmed successfully');
        }
      }

      log('info', 'Order transaction updated successfully');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          data: { 
            orderId: targetOrderId, 
            transactionSignature, 
            amountSol: amountSolFloat 
          } 
        })
      };
    } catch (error) {
      log('error', 'Error in update-order-transaction function:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Internal server error during single order update',
          details: error.message
        })
      };
    }
  }

  // If we reach here, something went wrong
  log('error', 'Failed to update transaction - no valid order ID or batch order ID found', {
    attemptedOrderId: targetOrderId,
    attemptedBatchOrderId: targetBatchOrderId
  });
  return {
    statusCode: 400,
    headers,
    body: JSON.stringify({ 
      error: 'Failed to update transaction - no valid order ID or batch order ID found',
      attemptedOrderId: targetOrderId,
      attemptedBatchOrderId: targetBatchOrderId
    })
  };
}; 