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

/**
 * Verify and update the order status using approach from frontend
 * Updated to support batch orders
 */
async function confirmOrderPayment(orderId, signature, verification, batchOrderId) {
  // ... existing code ...
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

  // If we don't have an orderId but have a signature, try to recover
  if (!targetOrderId && transactionSignature) {
    log('info', 'No order ID provided, attempting to recover from transaction signature');
    
    try {
      // Check if any orders already have this transaction signature
      log('debug', 'Checking for existing orders with transaction signature');
      const { data: existingOrders, error: existingError } = await supabase
        .from('orders')
        .select('id, batch_order_id')
        .eq('transaction_signature', transactionSignature)
        .limit(1);
      
      if (!existingError && existingOrders && existingOrders.length > 0) {
        targetOrderId = existingOrders[0].id;
        if (existingOrders[0].batch_order_id) {
          targetBatchOrderId = existingOrders[0].batch_order_id;
          log('info', `Found existing order ${targetOrderId} part of batch ${targetBatchOrderId}`);
        } else {
          log('info', `Found existing order ${targetOrderId}`);
        }
      } else {
        log('debug', 'No existing orders found with this transaction signature');
      }
    } catch (error) {
      log('error', 'Error recovering order from transaction signature:', error);
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
          .select('id, status, order_number, payment_metadata')
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

        // If no orders found using batch_order_id column, try using payment_metadata
        if (!batchOrders || batchOrders.length === 0) {
          log('info', 'No orders found with batch_order_id column, trying with payment_metadata.batchOrderId');
          
          const { data: metadataOrders, error: metadataError } = await supabase
            .from('orders')
            .select('id, status, order_number')
            .filter('payment_metadata->batchOrderId', 'eq', targetBatchOrderId)
            .in('status', ['draft']);
            
          if (!metadataError && metadataOrders && metadataOrders.length > 0) {
            log('info', `Found ${metadataOrders.length} orders with matching batchOrderId in metadata`);
            
            // First, update all these orders to set their batch_order_id field
            const orderIds = metadataOrders.map(order => order.id);
            
            log('info', `Updating ${orderIds.length} orders to set batch_order_id field`);
            
            // Get the SF-style order number from any order that already has it
            let sfOrderNumber;
            
            const { data: existingOrders, error: existingOrdersError } = await supabase
              .from('orders')
              .select('order_number')
              .eq('batch_order_id', targetBatchOrderId)
              .limit(1);
              
            if (!existingOrdersError && existingOrders && existingOrders.length > 0) {
              sfOrderNumber = existingOrders[0].order_number;
              log('info', `Found existing SF order number: ${sfOrderNumber}`);
            }
            
            // If no SF order number found, generate one
            if (!sfOrderNumber || !sfOrderNumber.startsWith('SF-')) {
              // Generate a SF-style order number (SF-MMDD-XXXX)
              const now = new Date();
              const month = now.getMonth() + 1;
              const day = now.getDate();
              sfOrderNumber = `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
              log('info', `Generated new SF order number: ${sfOrderNumber}`);
            }
            
            // Update all orders with batch ID and consistent order number
            const { error: updateBatchIdError } = await supabase
              .from('orders')
              .update({
                batch_order_id: targetBatchOrderId,
                order_number: sfOrderNumber,
                updated_at: new Date().toISOString()
              })
              .in('id', orderIds);
              
            if (updateBatchIdError) {
              log('error', 'Error updating batch_order_id and order_number:', updateBatchIdError);
              // Continue with the process anyway - we'll try to handle what we have
            } else {
              log('info', 'Successfully updated batch_order_id and order_number for all orders');
            }
            
            // Now continue with the remaining orders
            return exports.handler(event, context);
          }
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
            
            // Update all pending orders with the transaction signature and correct split amount
            const allPendingOrderIds = pendingOrders.map(order => order.id);
            log('info', `Updating all ${allPendingOrderIds.length} pending orders with transaction signature`);
            
            const { error: updateAllError } = await supabase
              .from('orders')
              .update({
                transaction_signature: transactionSignature,
                amount_sol: amountSolFloat / pendingOrders.length,
                updated_at: new Date().toISOString()
              })
              .in('id', allPendingOrderIds);
            
            if (updateAllError) {
              log('error', 'Error updating all pending orders:', updateAllError);
              return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                  error: 'Failed to update transaction signature for pending orders',
                  details: updateAllError.message
                })
              };
            } else {
              log('info', `Successfully updated transaction signature for all ${pendingOrders.length} pending orders`);
            }
            
            // For free orders, transition all orders to confirmed status
            if (isFreeOrder) {
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

        // Update ALL orders in the batch with transaction signature and proper amount
        const allOrderIds = batchOrders.map(order => order.id);
        
        log('info', `Updating all ${allOrderIds.length} orders with transaction signature`);
        
        // Update each order individually to set the correct amount based on its price
        for (const order of batchOrders) {
          // Get the correct price from the order's payment_metadata
          const originalPrice = order.payment_metadata?.originalPrice || 0;
          const couponDiscount = order.payment_metadata?.couponDiscount || 0;
          const orderAmount = Math.max(0, originalPrice - couponDiscount);
          
          log('debug', `Setting amount for order ${order.id}: ${orderAmount} SOL`, {
            originalPrice,
            couponDiscount,
            finalAmount: orderAmount
          });
          
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              status: 'pending_payment',
              transaction_signature: transactionSignature,
              amount_sol: orderAmount,
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);
            
          if (updateError) {
            log('error', `Error updating order ${order.id}:`, updateError);
          }
        }
        
        // If there were any errors in individual updates, try a batch update as fallback
        const { error: updateCheckError, data: updateCheck } = await supabase
          .from('orders')
          .select('id, status')
          .eq('batch_order_id', targetBatchOrderId)
          .eq('status', 'pending_payment')
          .is('transaction_signature', null);
          
        if (!updateCheckError && updateCheck && updateCheck.length > 0) {
          log('warn', `${updateCheck.length} orders were not updated properly, trying batch update`);
          
          const remainingIds = updateCheck.map(o => o.id);
          
          const { error: batchUpdateError } = await supabase
            .from('orders')
            .update({
              status: 'pending_payment',
              transaction_signature: transactionSignature,
              updated_at: new Date().toISOString()
            })
            .in('id', remainingIds);
            
          if (batchUpdateError) {
            log('error', 'Fallback batch update failed:', batchUpdateError);
          }
        }

        // For free orders, confirm all orders in the batch
        if (isFreeOrder) {
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