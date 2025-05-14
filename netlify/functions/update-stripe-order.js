/**
 * Updates orders with Stripe payment information and confirms batch orders
 * 
 * This endpoint is designed to work with both single orders and batch orders,
 * updating the transaction signature and status to confirmed after successful payment.
 */

const { createClient } = require('@supabase/supabase-js');

// Add better Supabase connection handling
// Initialize Supabase with service role key to bypass RLS policies
let supabase;
try {
  supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );
  console.log('Supabase client initialized with URL:', process.env.VITE_SUPABASE_URL);
} catch (initError) {
  console.error('Failed to initialize Supabase client:', initError);
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
  } catch (error) {
    console.error('Failed to parse request body:', error, 'Raw body:', event.body);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  const { orderId, paymentIntentId } = body;

  if (!orderId || !paymentIntentId) {
    console.error('Missing required parameters:', { orderId, paymentIntentId });
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing required parameters' })
    };
  }

  // Validate Supabase client
  if (!supabase) {
    console.error('Supabase client not initialized');
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

  // Log request details
  console.log('Stripe order update request:', { orderId, paymentIntentId });

  try {
    // Check current order status and if it's part of a batch
    let order;
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, transaction_signature, payment_metadata, batch_order_id, order_number')
        .eq('id', orderId)
        .single();
      
      if (error) {
        throw error;
      }
      
      order = data;
    } catch (orderFetchError) {
      console.error('Error fetching order:', orderFetchError);
      
      // Try to force update even if we can't fetch the order details
      try {
        console.log('Trying direct update without fetching order first');
        
        // First try to update with RPC
        try {
          const { error: rpcError } = await supabase.rpc('confirm_stripe_payment', {
            p_payment_id: paymentIntentId,
            p_order_id: orderId
          });
          
          if (rpcError) {
            console.warn('RPC confirmation failed:', rpcError);
            throw rpcError;
          }
          
          console.log('RPC function recovery succeeded');
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
          console.warn('RPC recovery failed, trying direct table update');
        }
        
        // Fall back to direct table update
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
          console.warn('Direct update recovery failed:', directUpdateError);
          throw directUpdateError;
        }
        
        console.log('Direct table update recovery succeeded');
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
        console.error('Recovery attempt failed:', recoveryError);
        
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

    console.log('Current order status:', order.status);
    
    // Check if this is a batch order
    const isBatchOrder = !!order.batch_order_id;
    console.log('Is batch order:', isBatchOrder);
    
    // Check order status - should be in 'draft' status for new orders
    // We only want to process orders in draft status, as we'll update them to pending_payment
    if (order.status !== 'draft') {
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
      console.log('Processing batch order:', order.batch_order_id);
      
      // First update the transaction signature and set status to pending_payment for all orders in the batch
      const { data: batchOrders, error: batchError } = await supabase
        .from('orders')
        .update({
          status: 'pending_payment',
          transaction_signature: paymentIntentId,
          payment_metadata: metadata,
          updated_at: new Date().toISOString()
        })
        .eq('batch_order_id', order.batch_order_id)
        .select('id, status, order_number');
      
      if (batchError) {
        console.error('Failed to update batch transaction signatures:', batchError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to update batch orders', details: batchError.message })
        };
      }
      
      // Now update the status to confirmed for each batch order
      updatedOrders = await Promise.all(batchOrders.map(async (batchOrder) => {
        try {
          // Try to use confirm_stripe_payment RPC function first
          const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_stripe_payment', {
            p_payment_id: paymentIntentId,
            p_order_id: batchOrder.id
          });
          
          if (rpcError) {
            console.error(`RPC function error for order ${batchOrder.id}:`, rpcError);
            
            // Fall back to direct update to set status to confirmed
            const { error: updateError } = await supabase
              .from('orders')
              .update({
                status: 'confirmed',
                updated_at: new Date().toISOString()
              })
              .eq('id', batchOrder.id);
            
            if (updateError) {
              console.error(`Failed to update order ${batchOrder.id}:`, updateError);
              return {
                orderId: batchOrder.id,
                orderNumber: batchOrder.order_number,
                status: 'pending_payment', // We at least moved it to pending_payment
                updated: false,
                error: updateError.message
              };
            }
          }
          
          return {
            orderId: batchOrder.id,
            orderNumber: batchOrder.order_number,
            status: 'confirmed',
            updated: true
          };
        } catch (orderError) {
          console.error(`Error processing order ${batchOrder.id}:`, orderError);
          return {
            orderId: batchOrder.id,
            orderNumber: batchOrder.order_number,
            status: 'pending_payment',
            updated: false,
            error: orderError.message
          };
        }
      }));
      
      // Count successfully updated orders
      const successCount = updatedOrders.filter(o => o.updated).length;
      console.log(`Successfully updated ${successCount}/${updatedOrders.length} orders in batch`);
      
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
        console.error('Failed to update order to pending_payment:', pendingUpdateError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to update order to pending_payment', details: pendingUpdateError.message })
        };
      }

      console.log('Order updated to pending_payment status');

      // Try to call RPC function first to confirm the order
      try {
        console.log('Attempting to use confirm_stripe_payment RPC function');
        const { data: rpcResult, error: rpcError } = await supabase.rpc('confirm_stripe_payment', {
          p_payment_id: paymentIntentId,
          p_order_id: orderId
        });
        
        if (rpcError) {
          console.error('RPC function error:', rpcError);
          // Continue to direct update fallback
        } else {
          console.log('RPC function success:', rpcResult);
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
        console.error('Error calling RPC function:', rpcError);
        // Continue to direct update fallback
      }

      // Update order status to confirmed
      console.log('Falling back to direct table update for confirmation');
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Failed to update order to confirmed:', updateError);
        
        // If direct update fails, try SQL function as a last resort
        try {
          console.log('Attempting direct SQL update as last resort');
          const { error: sqlError } = await supabase.rpc('admin_force_confirm_order', {
            p_order_id: orderId,
            p_transaction_signature: paymentIntentId
          });
          
          if (sqlError) {
            console.error('SQL function error:', sqlError);
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
          
          console.log('SQL function success');
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
          console.error('Error calling SQL function:', sqlError);
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
      console.log('Order confirmed via direct update:', orderId);

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
    console.error('Error in update-stripe-order:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}; 