/**
 * STRIPE HELPER
 * 
 * Server-side utilities for Stripe payment processing
 * Used to verify and repair order status after payments
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

// Initialize Supabase with service role key
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Enable detailed logging
const DEBUG = true;

/**
 * Enhanced logging function with prefixes and timestamps
 */
function log(level, message, data = null) {
  const prefix = '[STRIPE-HELPER]';
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

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request
    const requestBody = JSON.parse(event.body);

    // Extract request details
    const { action, paymentIntentId, orderId, batchOrderId } = requestBody;

    if (!action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing action parameter' })
      };
    }

    // Action: verify Stripe payment intent
    if (action === 'verify') {
      if (!paymentIntentId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing paymentIntentId parameter' })
        };
      }

      log('info', `Verifying Stripe payment intent: ${paymentIntentId}`);

      try {
        // Retrieve payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (!paymentIntent) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Payment intent not found' })
          };
        }

        log('info', `Found payment intent with status: ${paymentIntent.status}`);

        // Extract metadata
        const metadata = paymentIntent.metadata || {};
        
        // Log the metadata for debugging
        log('debug', 'Payment intent metadata:', metadata);

        // Return payment intent data
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            data: {
              id: paymentIntent.id,
              status: paymentIntent.status,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              metadata: metadata,
              orderId: metadata.orderIdStr || null,
              batchOrderId: metadata.batchOrderIdStr || null,
              orderNumber: metadata.orderNumberStr || null
            }
          })
        };
      } catch (stripeError) {
        log('error', 'Error retrieving payment intent:', stripeError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Failed to retrieve payment intent',
            details: stripeError.message
          })
        };
      }
    }

    // Action: repair order with payment
    if (action === 'repair' && paymentIntentId) {
      if (!paymentIntentId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing paymentIntentId parameter' })
        };
      }
      
      // We need either orderId or batchOrderId to repair
      if (!orderId && !batchOrderId) {
        // Try to extract from metadata
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          const metadata = paymentIntent.metadata || {};
          const metaOrderId = metadata.orderIdStr;
          const metaBatchOrderId = metadata.batchOrderIdStr;
          
          if (!metaOrderId && !metaBatchOrderId) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ 
                error: 'Cannot repair order - no order ID provided and none found in payment intent metadata',
                paymentIntentId
              })
            };
          }
          
          // Use the IDs from metadata
          if (metaOrderId) {
            log('info', `Using order ID from metadata: ${metaOrderId}`);
            requestBody.orderId = metaOrderId;
          }
          
          if (metaBatchOrderId) {
            log('info', `Using batch order ID from metadata: ${metaBatchOrderId}`);
            requestBody.batchOrderId = metaBatchOrderId;
          }
        } catch (metadataError) {
          log('error', 'Error extracting metadata from payment intent:', metadataError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              error: 'Failed to extract metadata from payment intent',
              details: metadataError.message
            })
          };
        }
      }
      
      // If we have a specific orderId, repair that order
      if (requestBody.orderId) {
        log('info', `Repairing order ${requestBody.orderId} with payment intent ${paymentIntentId}`);
        
        try {
          // First try using our RPC function
          const { error: rpcError } = await supabase.rpc('confirm_stripe_payment', {
            p_payment_id: paymentIntentId,
            p_order_id: requestBody.orderId
          });
          
          if (rpcError) {
            log('warn', 'RPC function failed, falling back to direct update:', rpcError);
            
            // Fallback to direct update
            // First move it to pending_payment if it's still in draft
            const { error: draftError } = await supabase
              .from('orders')
              .update({ 
                status: 'pending_payment',
                transaction_signature: paymentIntentId,
                updated_at: new Date().toISOString()
              })
              .eq('id', requestBody.orderId)
              .eq('status', 'draft');
              
            if (draftError) {
              log('warn', 'Error updating draft order:', draftError);
            }
            
            // Then confirm it
            const { error: confirmError } = await supabase
              .from('orders')
              .update({ 
                status: 'confirmed',
                updated_at: new Date().toISOString()
              })
              .eq('id', requestBody.orderId)
              .in('status', ['pending_payment', 'draft']); // Allow both to handle race conditions
              
            if (confirmError) {
              log('error', 'Error confirming order:', confirmError);
              throw confirmError;
            }
          }
          
          // Get the updated order
          const { data: updatedOrder, error: fetchError } = await supabase
            .from('orders')
            .select('id, status, order_number, transaction_signature')
            .eq('id', requestBody.orderId)
            .single();
            
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Order repaired successfully',
              order: updatedOrder
            })
          };
        } catch (repairError) {
          log('error', 'Error repairing order:', repairError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              error: 'Failed to repair order',
              details: repairError.message
            })
          };
        }
      }
      
      // If we have a batchOrderId, repair all orders in the batch
      if (requestBody.batchOrderId) {
        log('info', `Repairing batch order ${requestBody.batchOrderId} with payment intent ${paymentIntentId}`);
        
        try {
          // First get all orders in the batch
          const { data: batchOrders, error: batchError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('batch_order_id', requestBody.batchOrderId);
            
          if (batchError) {
            log('error', 'Error fetching batch orders:', batchError);
            throw batchError;
          }
          
          if (!batchOrders || batchOrders.length === 0) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({
                error: 'No orders found in batch',
                batchOrderId: requestBody.batchOrderId
              })
            };
          }
          
          log('info', `Found ${batchOrders.length} orders in batch ${requestBody.batchOrderId}`);
          
          // Sort orders by status - draft first, then pending_payment, then others
          const draftOrders = batchOrders.filter(o => o.status === 'draft');
          const pendingOrders = batchOrders.filter(o => o.status === 'pending_payment');
          const otherOrders = batchOrders.filter(o => o.status !== 'draft' && o.status !== 'pending_payment');
          
          // Process draft orders
          if (draftOrders.length > 0) {
            log('info', `Processing ${draftOrders.length} draft orders`);
            
            // Update first order with transaction signature
            const firstOrderId = draftOrders[0].id;
            
            const { error: firstUpdateError } = await supabase
              .from('orders')
              .update({
                status: 'pending_payment',
                transaction_signature: paymentIntentId,
                updated_at: new Date().toISOString()
              })
              .eq('id', firstOrderId)
              .eq('status', 'draft');
              
            if (firstUpdateError) {
              log('error', 'Error updating first draft order:', firstUpdateError);
              throw firstUpdateError;
            }
            
            // Update remaining draft orders
            if (draftOrders.length > 1) {
              const remainingOrderIds = draftOrders.slice(1).map(o => o.id);
              
              const { error: batchUpdateError } = await supabase
                .from('orders')
                .update({
                  status: 'pending_payment',
                  updated_at: new Date().toISOString()
                })
                .in('id', remainingOrderIds)
                .eq('status', 'draft');
                
              if (batchUpdateError) {
                log('warn', 'Error updating remaining draft orders:', batchUpdateError);
                // Continue anyway since the first order was updated
              }
            }
          }
          
          // Process pending orders
          if (draftOrders.length > 0 || pendingOrders.length > 0) {
            log('info', `Confirming orders in batch ${requestBody.batchOrderId}`);
            
            const orderIdsToConfirm = [
              ...draftOrders.map(o => o.id),
              ...pendingOrders.map(o => o.id)
            ];
            
            if (orderIdsToConfirm.length > 0) {
              const { error: confirmError } = await supabase
                .from('orders')
                .update({
                  status: 'confirmed',
                  updated_at: new Date().toISOString()
                })
                .in('id', orderIdsToConfirm)
                .in('status', ['draft', 'pending_payment']);
                
              if (confirmError) {
                log('error', 'Error confirming batch orders:', confirmError);
                throw confirmError;
              }
            }
          }
          
          // Get the updated batch orders
          const { data: updatedBatch, error: fetchError } = await supabase
            .from('orders')
            .select('id, status, order_number, transaction_signature')
            .eq('batch_order_id', requestBody.batchOrderId);
            
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              message: 'Batch order repaired successfully',
              orders: updatedBatch,
              draftFixed: draftOrders.length,
              pendingFixed: pendingOrders.length,
              alreadyProcessed: otherOrders.length
            })
          };
        } catch (batchRepairError) {
          log('error', 'Error repairing batch order:', batchRepairError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              error: 'Failed to repair batch order',
              details: batchRepairError.message
            })
          };
        }
      }
      
      // If we reach here, we don't have enough information to repair
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required parameters for repair action',
          tip: 'Provide orderId or batchOrderId'
        })
      };
    }

    // Unknown action
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Unknown action: ${action}` })
    };
  } catch (error) {
    log('error', 'Unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}; 