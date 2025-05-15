/**
 * UPDATE ORDER TRANSACTION
 * 
 * Server-side function for updating orders with transaction signature
 * This handles both individual orders and batch orders consistently
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check if supabase client is initialized
  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Database connection unavailable' })
    };
  }

  try {
    // Parse and validate request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      log('error', 'Failed to parse request body:', error.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid request body format' })
      };
    }

    // Extract parameters
    const {
      orderId: targetOrderId,
      transactionSignature,
      amountSol,
      batchOrderId: targetBatchOrderId,
      isBatchOrder = false,
      isFreeOrder = false
    } = requestBody;

    // Validate essential parameters
    if (!transactionSignature) {
      log('error', 'Missing required parameter: transactionSignature');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameter: transactionSignature' })
      };
    }

    // Must provide either orderId or batchOrderId
    if (!targetOrderId && !targetBatchOrderId && !isBatchOrder) {
      log('error', 'Missing required parameter: orderId or batchOrderId');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameter: orderId or batchOrderId' })
      };
    }

    // Format amount correctly
    const amountSolFloat = parseFloat(amountSol || 0);

    log('info', 'Request params:', {
      orderId: targetOrderId || 'none',
      batchOrderId: targetBatchOrderId || 'none',
      transactionSignature: transactionSignature ? transactionSignature.substring(0, 8) + '...' : 'none',
      amountSol: amountSolFloat,
      isBatchOrder,
      isFreeOrder
    });

    // For single orders, process directly
    if (targetOrderId && !targetBatchOrderId && !isBatchOrder) {
      log('info', `Processing single order transaction update for order: ${targetOrderId}`);

      try {
        // First ensure we know the status of the order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('id, status, batch_order_id')
          .eq('id', targetOrderId)
          .single();

        if (orderError) {
          log('error', 'Error fetching order data:', orderError);
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Order not found' })
          };
        }

        // If the order is part of a batch, redirect to batch processing
        if (orderData.batch_order_id) {
          log('info', `Order ${targetOrderId} is part of batch ${orderData.batch_order_id}, redirecting to batch processing`);
          return await updateBatchOrderTransaction(
            orderData.batch_order_id,
            transactionSignature,
            amountSolFloat,
            isFreeOrder,
            headers
          );
        }

        // Update the order transaction using the stored procedure
        log('info', `Updating transaction for single order ${targetOrderId}`);

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

        // For free orders, confirm immediately
        if (isFreeOrder) {
          log('info', `Auto-confirming free order: ${targetOrderId}`);

          const { error: confirmError } = await supabase.rpc('confirm_order_transaction', {
            p_order_id: targetOrderId
          });

          if (confirmError) {
            log('error', 'Error confirming free order:', confirmError);
            // Continue anyway - the order is at least in pending_payment state
          } else {
            log('info', 'Free order confirmed successfully');
          }
        }

        // Update the transaction log
        try {
          const { error: logError } = await supabase.rpc('update_transaction_status', {
            p_signature: transactionSignature,
            p_status: 'pending',
            p_details: {
              orderId: targetOrderId,
              amountSol: amountSolFloat,
              timestamp: new Date().toISOString()
            }
          });

          if (logError) {
            log('warn', 'Failed to update transaction log:', logError);
            // Continue anyway - this is just for logging
          }
        } catch (error) {
          log('warn', 'Exception updating transaction log:', error);
          // Continue anyway - this is just for logging
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
        log('error', 'Exception in single order update:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: error.message })
        };
      }
    }

    // If we have a batch order ID, use it for updating all related orders
    if (targetBatchOrderId || (targetOrderId && isBatchOrder === true)) {
      // If we don't have batch ID but isBatchOrder is true, find batch ID from order ID
      let batchOrderId = targetBatchOrderId;
      
      if (!batchOrderId && targetOrderId) {
        log('info', 'isBatchOrder is true but no batchOrderId, looking up from orderId');
        try {
          const { data, error } = await supabase
            .from('orders')
            .select('batch_order_id, payment_metadata')
            .eq('id', targetOrderId)
            .single();

          if (error) {
            log('error', 'Error getting batch ID from order:', error);
          } else if (data) {
            if (data.batch_order_id) {
              batchOrderId = data.batch_order_id;
              log('info', `Found batch ID ${batchOrderId} from order.batch_order_id column`);
            } else if (data.payment_metadata?.batchOrderId) {
              batchOrderId = data.payment_metadata.batchOrderId;
              log('info', `Found batch ID ${batchOrderId} from order.payment_metadata.batchOrderId`);
            } else {
              log('warn', `No batch ID found for order ${targetOrderId}`);
            }
          }
        } catch (error) {
          log('error', 'Exception getting batch ID from order:', error);
        }
      }

      if (batchOrderId) {
        return await updateBatchOrderTransaction(
          batchOrderId,
          transactionSignature,
          amountSolFloat,
          isFreeOrder,
          headers
        );
      }
    }

    // If we got here, we couldn't find a valid batch ID
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Could not determine batch order ID for update' })
    };
  } catch (error) {
    log('error', 'Unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

/**
 * Helper function to update a batch of orders with transaction signature
 */
async function updateBatchOrderTransaction(batchOrderId, transactionSignature, amountSolFloat, isFreeOrder, headers) {
  log('info', `Processing batch order transaction update for batch: ${batchOrderId}`, {
    transactionSignature: transactionSignature ? `${transactionSignature.substring(0, 8)}...` : 'none',
    amountSol: amountSolFloat,
    isFreeOrder
  });

  try {
    // First, check if any orders in this batch have the transaction signature already
    // This could happen if the function is called multiple times
    const { data: existingTx, error: existingError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('batch_order_id', batchOrderId)
      .eq('transaction_signature', transactionSignature);
      
    if (!existingError && existingTx && existingTx.length > 0) {
      log('info', `${existingTx.length} orders in batch already have this transaction signature`);
      
      if (existingTx.length > 0) {
        // If some orders already have this transaction, return success
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true, 
            data: { 
              batchOrderId,
              transactionSignature, 
              amountSol: amountSolFloat,
              isBatchOrder: true,
              ordersUpdated: existingTx.length,
              message: 'Orders already have this transaction signature'
            } 
          })
        };
      }
    }
  
    // STEP 1: Find ALL orders related to this batch with ANY status
    // This includes orders that might have batch_order_id in metadata but not column
    let allBatchOrders = [];
    
    // First try finding orders with batch_order_id column set
    const { data: batchOrders, error: batchError } = await supabase
      .from('orders')
      .select('id, status, order_number, payment_metadata, batch_order_id, variant_selections')
      .eq('batch_order_id', batchOrderId);

    if (batchError) {
      log('error', 'Error fetching batch orders by column:', batchError);
      // Continue to try metadata search
    } else if (batchOrders && batchOrders.length > 0) {
      allBatchOrders = [...batchOrders];
      log('info', `Found ${batchOrders.length} orders with batch_order_id column set`);
    }
    
    // Also find orders that have batch ID only in metadata
    const { data: metadataOrders, error: metadataError } = await supabase
      .from('orders')
      .select('id, status, order_number, payment_metadata, batch_order_id, variant_selections')
      .is('batch_order_id', null)
      .filter('payment_metadata->batchOrderId', 'eq', batchOrderId);
      
    if (metadataError) {
      log('error', 'Error fetching batch orders by metadata:', metadataError);
    } else if (metadataOrders && metadataOrders.length > 0) {
      // Add orders found only in metadata (no duplicates)
      const existingIds = new Set(allBatchOrders.map(o => o.id));
      const newOrders = metadataOrders.filter(o => !existingIds.has(o.id));
      
      if (newOrders.length > 0) {
        allBatchOrders.push(...newOrders);
        log('info', `Found ${newOrders.length} additional orders with batch_order_id in metadata`);
      }
    }
    
    if (allBatchOrders.length === 0) {
      log('error', `No orders found for batch: ${batchOrderId}`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          error: 'No orders found for batch',
          batchOrderId 
        })
      };
    }
    
    log('info', `Found total of ${allBatchOrders.length} orders in batch ${batchOrderId}`);
    
    // STEP 2: Make sure ALL orders have batch_order_id set in the column
    const ordersMissingBatchId = allBatchOrders.filter(order => !order.batch_order_id);
    if (ordersMissingBatchId.length > 0) {
      const orderIdsToUpdate = ordersMissingBatchId.map(order => order.id);
      log('info', `Setting batch_order_id column for ${orderIdsToUpdate.length} orders`);
      
      const { error: batchIdUpdateError } = await supabase
        .from('orders')
        .update({
          batch_order_id: batchOrderId,
          updated_at: new Date().toISOString()
        })
        .in('id', orderIdsToUpdate);
      
      if (batchIdUpdateError) {
        log('error', `Error updating batch_order_id for orders:`, batchIdUpdateError);
      } else {
        log('info', `Successfully updated batch_order_id for ${orderIdsToUpdate.length} orders`);
      }
    }
    
    // STEP 3: Identify orders with draft/pending status to update with transaction signature
    const pendingOrders = allBatchOrders.filter(o => o.status === 'draft' || o.status === 'pending_payment');
    log('info', `Found ${pendingOrders.length} orders in draft/pending status to update with transaction`);
    
    if (pendingOrders.length > 0) {
      // Create a map of order IDs to their variant pricing
      const orderPricing = {};
      
      // Calculate the correct price for each order based on variants
      pendingOrders.forEach(order => {
        try {
          // Start with base logic - if no variant info, use equal split
          let orderAmount = amountSolFloat / pendingOrders.length;
          
          // Get variant info if available
          const metadata = order.payment_metadata || {};
          const variantKey = metadata.variantKey;
          const variantPrices = metadata.variantPrices;
          
          // If we have variant pricing, use the specific variant price
          if (variantKey && variantPrices && variantPrices[variantKey]) {
            orderAmount = parseFloat(variantPrices[variantKey]);
            log('debug', `Using variant price for order ${order.id}: ${orderAmount} SOL`, { 
              variantKey, 
              price: variantPrices[variantKey] 
            });
          } else if (metadata.originalPrice) {
            // Otherwise use originalPrice from metadata if available
            const originalPrice = parseFloat(metadata.originalPrice);
            const couponDiscount = parseFloat(metadata.couponDiscount || 0);
            orderAmount = Math.max(0, originalPrice - couponDiscount);
            log('debug', `Using metadata price for order ${order.id}: ${orderAmount} SOL`, { 
              originalPrice, 
              couponDiscount 
            });
          }
          
          // Store the calculated amount
          orderPricing[order.id] = orderAmount;
        } catch (error) {
          log('error', `Error calculating price for order ${order.id}:`, error);
          // Default to equal split if calculation fails
          orderPricing[order.id] = amountSolFloat / pendingOrders.length;
        }
      });
      
      // Update each order individually with the correct price
      const updateResults = [];
      for (const order of pendingOrders) {
        try {
          const orderAmount = orderPricing[order.id] || 0;
          
          log('info', `Updating order ${order.id} with transaction signature and amount ${orderAmount}`);
          
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              transaction_signature: transactionSignature,
              amount_sol: orderAmount,
              status: 'pending_payment', // Always set status to pending_payment
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);
            
          if (updateError) {
            log('error', `Error updating order ${order.id}:`, updateError);
            updateResults.push({
              orderId: order.id,
              success: false,
              error: updateError.message
            });
          } else {
            updateResults.push({
              orderId: order.id,
              success: true,
              amount: orderAmount
            });
          }
        } catch (error) {
          log('error', `Exception updating order ${order.id}:`, error);
          updateResults.push({
            orderId: order.id,
            success: false,
            error: error.message
          });
        }
      }
      
      // STEP 4: For free orders, confirm all orders in the batch immediately
      if (isFreeOrder) {
        try {
          const allOrderIds = pendingOrders.map(order => order.id);
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
        } catch (error) {
          log('error', 'Error auto-confirming free batch orders:', error);
        }
      }
      
      // STEP 5: Update the transaction log
      try {
        const { error: logError } = await supabase.rpc('update_transaction_status', {
          p_signature: transactionSignature,
          p_status: 'pending',
          p_details: {
            batchOrderId,
            orderCount: allBatchOrders.length,
            updatedOrders: pendingOrders.length,
            amountSol: amountSolFloat,
            isFreeOrder,
            timestamp: new Date().toISOString()
          }
        });

        if (logError) {
          log('warn', 'Failed to update transaction log:', logError);
          // Continue anyway - this is just for logging
        } else {
          log('info', 'Transaction log updated successfully');
        }
      } catch (error) {
        log('warn', 'Exception updating transaction log:', error);
        // Continue anyway - this is just for logging
      }
      
      // Return success response with details about updated orders
      log('info', `Batch order transaction update completed successfully for batch ${batchOrderId}`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          data: { 
            batchOrderId,
            transactionSignature, 
            amountSol: amountSolFloat,
            isBatchOrder: true,
            totalOrders: allBatchOrders.length,
            ordersUpdated: updateResults.filter(r => r.success).length,
            updateDetails: updateResults
          } 
        })
      };
    } else {
      // No draft/pending orders found in this batch
      log('warn', `No draft/pending orders found in batch ${batchOrderId} to update with transaction`);
      
      // Get details about orders in other statuses
      const statusCounts = {};
      allBatchOrders.forEach(order => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      });
      
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'No draft or pending orders found in batch to update',
          details: {
            batchOrderId,
            totalOrders: allBatchOrders.length,
            statusCounts
          }
        })
      };
    }
  } catch (error) {
    log('error', `Error in batch order transaction update:`, error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: error.message,
        batchOrderId
      })
    };
  }
} 