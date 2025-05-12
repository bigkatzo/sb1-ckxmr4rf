/**
 * Client-side fallback for confirming Stripe orders
 * 
 * This endpoint can be called after a successful Stripe payment to ensure the order
 * is properly confirmed, even if the webhook hasn't processed yet.
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
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
  console.log('Client-side order confirmation request:', { orderId, paymentIntentId });

  try {
    // Check current order status
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, transaction_signature, payment_metadata')
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

    // Only proceed if the order is in pending_payment status
    if (order.status !== 'pending_payment') {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Order already processed', status: order.status })
      };
    }

    // Store the payment intent ID in metadata if it's not already there
    let metadata = order.payment_metadata || {};
    if (!metadata.paymentIntentId) {
      metadata.paymentIntentId = paymentIntentId;
    }

    // Update order status to confirmed and store payment intent
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'confirmed',
        transaction_signature: paymentIntentId,
        payment_metadata: metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Failed to update order:', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update order' })
      };
    }

    // Log successful update
    console.log('Order confirmed via client-side fallback:', orderId);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Order confirmed successfully',
        orderId: orderId,
        status: 'confirmed'
      })
    };
  } catch (error) {
    console.error('Error in confirm-stripe-order:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 