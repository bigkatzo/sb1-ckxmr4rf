/**
 * Updates orders with Stripe payment information and confirms batch orders
 * 
 * This endpoint is designed to work with both single orders and batch orders,
 * updating the transaction signature and status to confirmed after successful payment.
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with service role key to bypass RLS policies
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  const { orderId, paymentIntentId } = body;

  if (!orderId || !paymentIntentId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required parameters' })
    };
  }

  // Log request details
  console.log('Stripe order update request:', { orderId, paymentIntentId });

  try {
    // Check current order status and if it's part of a batch
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, transaction_signature, payment_metadata, batch_order_id, order_number')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Order not found:', orderError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Order not found' })
      };
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