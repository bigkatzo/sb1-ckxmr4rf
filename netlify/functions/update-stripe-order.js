/**
 * Updates orders with Stripe payment information and confirms batch orders
 * 
 * This endpoint is designed to work with both single orders and batch orders,
 * updating the transaction signature and status to confirmed after successful payment.
 */

const { createClient } = require('@supabase/supabase-js');

// Enable detailed logging
const DEBUG = true;

/**
 * Enhanced logging function with prefixes and timestamps
 */
function log(level, message, data = null) {
  const prefix = '[UPDATE-STRIPE-ORDER]';
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

// Add better Supabase connection handling
// Initialize Supabase with service role key to bypass RLS policies
let supabase;
try {
  supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );
  log('info', 'Supabase client initialized with URL:', process.env.VITE_SUPABASE_URL);
} catch (initError) {
  log('error', 'Failed to initialize Supabase client:', initError);
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

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    log('warn', 'Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Parse request body with better error handling
  let body;
  try {
    body = JSON.parse(event.body);
    log('info', 'Received request body:', {
      ...body,
      paymentIntentId: body.paymentIntentId ? `${body.paymentIntentId.substring(0, 8)}...` : 'missing'
    });
  } catch (error) {
    log('error', 'Failed to parse request body:', error, 'Raw body:', event.body);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  const { orderId, paymentIntentId } = body;

  if (!orderId || !paymentIntentId) {
    log('error', 'Missing required parameters:', { orderId, paymentIntentId });
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required parameters' })
    };
  }

  // Validate Supabase client
  if (!supabase) {
    log('error', 'Supabase client not initialized');
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ 
        error: 'Database connection not available',
        recoverable: true,
        message: 'Your payment was processed but we had trouble updating your order. It will be processed automatically.'
      })
    };
  }

  log('info', 'Stripe order update request:', { 
    orderId, 
    paymentIntentId: paymentIntentId.substring(0, 8) + '...' 
  });

  try {
    // Check current order status and if it's part of a batch
    let order;
    try {
      log('debug', 'Fetching order details for', orderId);
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, transaction_signature, payment_metadata, batch_order_id, order_number')
        .eq('id', orderId)
        .single();
      
      if (error) {
        log('error', 'Error fetching order details:', error);
        throw error;
      }
      
      order = data;
      log('info', 'Retrieved order details:', {
        id: order.id,
        status: order.status,
        orderNumber: order.order_number,
        batchOrderId: order.batch_order_id || 'none',
        hasTransactionSignature: !!order.transaction_signature
      });
    } catch (orderFetchError) {
      log('error', 'Error fetching order:', orderFetchError);
      
      // Try to force update even if we can't fetch the order details
      try {
        log('info', 'Trying direct update without fetching order first as recovery path');
        
        // First try to update with RPC
        try {
          log('debug', 'Attempting RPC recovery with confirm_stripe_payment');
          const { error: rpcError } = await supabase.rpc('confirm_stripe_payment', {
            p_payment_id: paymentIntentId,
            p_order_id: orderId
          });
          
          if (rpcError) {
            log('warn', 'RPC confirmation failed:', rpcError);
            throw rpcError;
          }
          
          log('info', 'RPC function recovery succeeded');
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
              success: true,
              message: 'Order updated via recovery RPC function',
              orderId,
              recoveryPath: 'rpc_direct'
            })
          };
        } catch (rpcError) {
          log('warn', 'RPC recovery failed, trying direct table update');
        }
        
        // Fall back to direct table update
        log('debug', 'Attempting direct table update recovery');
        const { error: directUpdateError } = await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            transaction_signature: paymentIntentId,
            payment_metadata: { 
              paymentIntentId,
              paymentMethod: 'stripe',
              recoveryTime: new Date().toISOString()
            }
          })
          .eq('id', orderId);
        
        if (directUpdateError) {
          log('warn', 'Direct update recovery failed:', directUpdateError);
          throw directUpdateError;
        }
        
        log('info', 'Direct table update recovery succeeded');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            success: true,
            message: 'Order updated via recovery direct update',
            orderId,
            recoveryPath: 'direct_update'
          })
        };
      } catch (recoveryError) {
        log('error', 'Recovery attempt failed:', recoveryError);
        
        // Return partial success because payment was processed
        return {
          statusCode: 202,
          headers,
          body: JSON.stringify({ 
            partial: true,
            error: 'Order fetch failed but payment was processed',
            orderId,
            paymentIntentId,
            message: 'Payment successful. Order will be processed automatically.'
          })
        };
      }
    }

    log('info', 'Current order status:', order.status);
    
    // Check if this is a batch order
    const isBatchOrder = !!order.batch_order_id;
    log('info', 'Is batch order:', isBatchOrder);
    
    // Check order status - should be in 'draft' status for new orders
    // We only want to process orders in draft status, as we'll update them to pending_payment
    if (order.status !== 'draft') {
      log('info', 'Order already processed with status:', order.status);
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Order already processed', 
          status: order.status,
          orderNumber: order.order_number
        })
      };
    }

    // Store the payment intent ID in metadata
    let metadata = order.payment_metadata || {};
    metadata.paymentIntentId = paymentIntentId;
    metadata.paymentMethod = 'stripe';
    
    let updatedOrders = [];
    
    // If this is a batch order, update all orders in the batch
    if (isBatchOrder) {
      log('info', 'Processing batch order:', order.batch_order_id);
      
      // First check if any orders in the batch already have a transaction_signature
      log('debug', 'Checking for existing transaction signatures in batch');
      const { data: existingSignatures, error: signatureError } = await supabase
        .from('orders')
        .select('transaction_signature')
        .eq('batch_order_id', order.batch_order_id)
        .not('transaction_signature', 'is', null)
        .limit(1);
      
      // If there's already a signature in the batch, handle it specially
      if (!signatureError && existingSignatures && existingSignatures.length > 0) {
        log('info', 'Found existing transaction signature in batch:', 
          existingSignatures[0].transaction_signature ? 
          existingSignatures[0].transaction_signature.substring(0, 8) + '...' : 'null');
        
        try {
          // Update batch orders to pending_payment status first
          log('debug', 'Updating remaining batch orders to pending_payment status');
          const { error: statusError } = await supabase
            .from('orders')
            .update({
              status: 'pending_payment',
              payment_metadata: metadata,
              updated_at: new Date().toISOString()
            })
            .eq('batch_order_id', order.batch_order_id)
            .eq('status', 'draft');
          
          if (statusError) {
            log('error', 'Failed to update batch order statuses:', statusError);
            return {
              statusCode: 500,
              body: JSON.stringify({ error: 'Failed to update batch orders', details: statusError.message })
            };
          }
          
          // Now update confirmed status for all batch orders
          log('debug', 'Attempting to confirm all batch orders with RPC function');
          const { error: confirmError } = await supabase.rpc('confirm_batch_order_transaction', {
            p_batch_order_id: order.batch_order_id
          });
          
          if (confirmError) {
            log('warn', 'Failed to confirm batch orders with RPC:', confirmError);
            // Try direct update as fallback
            log('debug', 'Falling back to direct update for batch confirmation');
            const { error: directError } = await supabase
              .from('orders')
              .update({
                status: 'confirmed',
                updated_at: new Date().toISOString()
              })
              .eq('batch_order_id', order.batch_order_id)
              .eq('status', 'pending_payment');
            
            if (directError) {
              log('error', 'Failed direct batch confirmation:', directError);
              return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to confirm batch orders', details: directError.message })
              };
            } else {
              log('info', 'Batch orders confirmed successfully via direct update');
            }
          } else {
            log('info', 'Batch orders confirmed successfully via RPC');
          }
          
          return {
            statusCode: 200,
            body: JSON.stringify({
              success: true,
              message: 'Batch orders updated and confirmed successfully',
              batchOrderId: order.batch_order_id
            })
          };
        } catch (batchUpdateError) {
          log('error', 'Error in batch order processing:', batchUpdateError);
          return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Batch order processing error', details: batchUpdateError.message })
          };
        }
      }
      
      // If no existing signature, proceed with normal update
      // First update the transaction signature and set status to pending_payment for all orders in the batch
      try {
        // Use batch update transaction function if available
        log('debug', 'Attempting to update batch orders with RPC function');
        const { error: batchError } = await supabase.rpc('update_batch_order_transaction', {
          p_batch_order_id: order.batch_order_id,
          p_transaction_signature: paymentIntentId,
          p_amount_sol: order.amount_sol || 0
        });
        
        if (batchError) {
          log('warn', 'Failed to update batch transaction with RPC:', batchError);
          // Fallback to direct update
          log('debug', 'Falling back to direct update for batch orders');
          const { data: batchOrders, error: fetchError } = await supabase
            .from('orders')
            .update({
              status: 'pending_payment',
              transaction_signature: paymentIntentId,
              payment_metadata: metadata,
              updated_at: new Date().toISOString()
            })
            .eq('batch_order_id', order.batch_order_id)
            .eq('status', 'draft')
            .select('id, status, order_number');
          
          if (fetchError) {
            log('error', 'Failed to update batch orders directly:', fetchError);
            return {
              statusCode: 500,
              body: JSON.stringify({ error: 'Failed to update batch orders', details: fetchError.message })
            };
          }
          
          updatedOrders = batchOrders || [];
          log('info', `Updated ${updatedOrders.length} batch orders via direct update`);
        } else {
          // Successful RPC call, now fetch the updated orders
          log('info', 'Batch orders updated successfully via RPC');
          log('debug', 'Fetching updated batch orders');
          const { data: batchOrders, error: fetchError } = await supabase
            .from('orders')
            .select('id, status, order_number')
            .eq('batch_order_id', order.batch_order_id);
          
          if (fetchError) {
            log('error', 'Failed to fetch batch orders after update:', fetchError);
          } else {
            updatedOrders = batchOrders || [];
            log('info', `Found ${updatedOrders.length} orders in batch`);
          }
        }
      } catch (batchError) {
        log('error', 'Error in batch order processing:', batchError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Batch order processing error', details: batchError.message })
        };
      }

      // Now confirm all orders that are in pending_payment status
      log('debug', 'Confirming all pending batch orders');
      try {
        const { error: confirmError } = await supabase.rpc('confirm_batch_order_transaction', {
          p_batch_order_id: order.batch_order_id
        });
        
        if (confirmError) {
          log('warn', 'Failed to confirm batch orders with RPC:', confirmError);
          // Try direct update as fallback
          log('debug', 'Falling back to direct update for batch confirmation');
          const { error: directError } = await supabase
            .from('orders')
            .update({
              status: 'confirmed',
              updated_at: new Date().toISOString()
            })
            .eq('batch_order_id', order.batch_order_id)
            .eq('status', 'pending_payment');
          
          if (directError) {
            log('error', 'Failed direct batch confirmation:', directError);
          } else {
            log('info', 'Batch orders confirmed successfully via direct update');
          }
        } else {
          log('info', 'Batch orders confirmed successfully via RPC');
        }
      } catch (confirmError) {
        log('error', 'Error confirming batch orders:', confirmError);
      }
      
      // Count successfully updated orders
      const successCount = updatedOrders.filter(o => o.status === 'confirmed' || o.status === 'pending_payment').length;
      log('info', `Successfully updated ${successCount}/${updatedOrders.length} orders in batch`);
      
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: successCount > 0,
          message: `Updated ${successCount}/${updatedOrders.length} orders in batch`,
          orders: updatedOrders,
          orderNumber: order.order_number
        })
      };
    } 
    // Single order processing
    else {
      // First update the order to pending_payment status
      log('debug', 'Updating single order to pending_payment status');
      const { error: pendingUpdateError } = await supabase
        .from('orders')
        .update({
          status: 'pending_payment',
          transaction_signature: paymentIntentId,
          payment_metadata: metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (pendingUpdateError) {
        log('error', 'Failed to update order to pending_payment:', pendingUpdateError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to update order to pending_payment', details: pendingUpdateError.message })
        };
      }

      log('info', 'Order updated to pending_payment status');

      // Try to call RPC function first to confirm the order
      try {
        log('debug', 'Attempting to use confirm_stripe_payment RPC function');
        const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_stripe_payment', {
          p_payment_id: paymentIntentId,
          p_order_id: orderId
        });
        
        if (rpcError) {
          log('warn', 'RPC function error:', rpcError);
          // Continue to direct update fallback
        } else {
          log('info', 'RPC function success:', rpcResult);
          return {
            statusCode: 200,
            body: JSON.stringify({ 
              success: true, 
              message: 'Order confirmed successfully via RPC',
              orderId: orderId,
              orderNumber: order.order_number,
              status: 'confirmed'
            })
          };
        }
      } catch (rpcError) {
        log('error', 'Error calling RPC function:', rpcError);
        // Continue to direct update fallback
      }

      // Update order status to confirmed
      log('debug', 'Falling back to direct table update for confirmation');
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        log('error', 'Failed to update order to confirmed:', updateError);
        
        // If direct update fails, try SQL function as a last resort
        try {
          log('debug', 'Attempting direct SQL update as last resort');
          const { error: sqlError } = await supabase.rpc('admin_force_confirm_order', {
            p_order_id: orderId,
            p_transaction_signature: paymentIntentId
          });
          
          if (sqlError) {
            log('error', 'SQL function error:', sqlError);
            return {
              statusCode: 200,
              body: JSON.stringify({ 
                success: true, 
                message: 'Order updated to pending_payment but could not be confirmed',
                orderId: orderId,
                orderNumber: order.order_number,
                status: 'pending_payment'
              })
            };
          }
          
          log('info', 'SQL function success');
          return {
            statusCode: 200,
            body: JSON.stringify({ 
              success: true, 
              message: 'Order confirmed successfully via SQL function',
              orderId: orderId,
              orderNumber: order.order_number,
              status: 'confirmed'
            })
          };
        } catch (sqlError) {
          log('error', 'Error calling SQL function:', sqlError);
          return {
            statusCode: 200,
            body: JSON.stringify({ 
              success: true, 
              message: 'Order updated to pending_payment but could not be confirmed',
              orderId: orderId,
              orderNumber: order.order_number,
              status: 'pending_payment'
            })
          };
        }
      }

      // Log successful update
      log('info', 'Order confirmed via direct update:', orderId);

      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'Order confirmed successfully',
          orderId: orderId,
          orderNumber: order.order_number,
          status: 'confirmed'
        })
      };
    }
  } catch (error) {
    log('error', 'Error in update-stripe-order:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}; 