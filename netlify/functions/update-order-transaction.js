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

    // Extract parameters - match the naming from create-batch-order
    const {
      orderId: targetOrderId,
      transactionSignature,
      // amountSol,
      batchOrderId: targetBatchOrderId,
      // should not matter here
      // isFreeOrder = false
    } = requestBody;

    // Validate essential parameters
    // if (!transactionSignature) {
    //   log('error', 'Missing required parameter: transactionSignature');
    //   return {
    //     statusCode: 400,
    //     headers,
    //     body: JSON.stringify({ error: 'Missing required parameter: transactionSignature' })
    //   };
    // }

    // Must provide either orderId or batchOrderId
    if (!targetOrderId && !targetBatchOrderId) {
      log('error', 'Missing required parameter: orderId or batchOrderId');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameter: orderId or batchOrderId' })
      };
    }

    // Format amount correctly
    // const amountSolFloat = parseFloat(amountSol || 0);

    log('info', 'Request params:', {
      orderId: targetOrderId || 'none',
      batchOrderId: targetBatchOrderId || 'none',
      transactionSignature: transactionSignature ? transactionSignature.substring(0, 8) + '...' : 'none',
      // amountSol: amountSolFloat,
      // isFreeOrder
    });

    // Determine if we're dealing with a batch order
    let batchOrderId = targetBatchOrderId;

    if (batchOrderId) {
      return await updateBatchOrderTransaction(
        batchOrderId,
        transactionSignature,
        // amountSolFloat,
        // isFreeOrder,
        headers
      );
    }

    // Process as single order
    if (targetOrderId) {
      log('info', `Processing single order transaction update for order: ${targetOrderId}`);

      try {
        // Update the order transaction
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            transaction_signature: transactionSignature,
            amount_sol: amountSolFloat,
            status: 'pending_payment',
            updated_at: new Date().toISOString()
          })
          .eq('id', targetOrderId);

        if (updateError) {
          log('error', 'Error updating order transaction:', updateError);
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: updateError.message })
          };
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
          }
        } catch (error) {
          log('warn', 'Exception updating transaction log:', error);
        }

        log('info', 'Single order transaction updated successfully');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              orderId: targetOrderId,
              transactionSignature,
              amountSol: amountSolFloat,
              isFreeOrder
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

    // If we got here, we couldn't determine what to update
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Could not determine order type for update' })
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
    // Check if any orders in this batch already have the transaction signature

    const { data: batchOrders, error: batchError } = await supabase
      .from('orders')
      .select('id, status, order_number, payment_metadata, batch_order_id')
      .eq('batch_order_id', batchOrderId);

    if (batchError || !batchOrders || batchOrders.length === 0) {
      log('error', 'Error fetching batch orders:', batchError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Failed to fetch batch orders' })
      };
    }
    
    log('info', `Found ${batchOrders.length} orders in batch ${batchOrderId}`);
    
    // Filter orders that need transaction updates (draft or pending_payment status)
    const ordersToUpdate = batchOrders.filter(order => 
      order.status === 'draft' || order.status === 'pending_payment'
    );
    
    log('info', `Found ${ordersToUpdate.length} orders to update with transaction signature`);
    
    if (ordersToUpdate.length === 0) {
      // No orders to update
      const statusCounts = {};
      batchOrders.forEach(order => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      });
      
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'No orders in draft or pending_payment status to update',
          details: {
            batchOrderId,
            totalOrders: batchOrders.length,
            statusCounts
          }
        })
      };
    }

    // Calculate individual order amounts
    const totalOrders = ordersToUpdate.length;
    const updateResults = [];
    
    for (const order of ordersToUpdate) {
      try {
        // Calculate amount for this order
        let orderAmount = amountSolFloat / totalOrders; // Default: equal split
        
        // Try to get variant-specific pricing from metadata
        const metadata = order.payment_metadata || {};
        const variantKey = metadata.variantKey;
        const variantPrices = metadata.variantPrices;
        
        if (variantKey && variantPrices && variantPrices[variantKey]) {
          orderAmount = parseFloat(variantPrices[variantKey]);
          log('debug', `Using variant price for order ${order.id}: ${orderAmount} SOL`);
        }
        
        // Update the order
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            transaction_signature: transactionSignature,
            amount_sol: orderAmount,
            status: isFreeOrder ? 'confirmed' : 'pending_payment',
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
          log('info', `Successfully updated order ${order.id} with amount ${orderAmount}`);
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
    
    // Update the transaction log
    try {
      const { error: logError } = await supabase.rpc('update_transaction_status', {
        p_signature: transactionSignature,
        p_status: 'pending',
        p_details: {
          batchOrderId,
          orderCount: batchOrders.length,
          updatedOrders: updateResults.filter(r => r.success).length,
          amountSol: amountSolFloat,
          isFreeOrder,
          timestamp: new Date().toISOString()
        }
      });

      if (logError) {
        log('warn', 'Failed to update transaction log:', logError);
      }
    } catch (error) {
      log('warn', 'Exception updating transaction log:', error);
    }
    
    const successfulUpdates = updateResults.filter(r => r.success).length;
    
    log('info', `Batch order transaction update completed: ${successfulUpdates}/${ordersToUpdate.length} orders updated successfully`);
    
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
          totalOrders: batchOrders.length,
          ordersUpdated: successfulUpdates,
          updateDetails: updateResults,
          isFreeOrder
        } 
      })
    };
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