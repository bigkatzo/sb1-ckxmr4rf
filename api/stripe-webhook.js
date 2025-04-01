const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Get the webhook secret from environment variables
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async (event, context) => {
  console.log('Webhook received:', event.httpMethod);
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get the signature from headers
    const signature = event.headers['stripe-signature'];
    if (!signature) {
      console.error('No Stripe signature found');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No signature provided' }),
      };
    }

    // Verify the event
    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        signature,
        webhookSecret
      );
      console.log('Webhook verified. Event:', stripeEvent.type);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid signature' }),
      };
    }

    // Handle the event
    switch (stripeEvent.type) {
      case 'payment_intent.processing': {
        const paymentIntent = stripeEvent.data.object;
        console.log('Processing payment:', paymentIntent.id);
        
        // Update order status to processing
        const { error } = await supabase.rpc('update_stripe_payment_status', {
          p_payment_id: paymentIntent.id,
          p_status: 'processing'
        });

        if (error) {
          console.error('Error updating processing status:', error);
          throw error;
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = stripeEvent.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        
        // Get order ID for this payment intent
        const { data: order, error: fetchError } = await supabase
          .from('orders')
          .select('id')
          .eq('transaction_signature', paymentIntent.id)
          .single();

        if (fetchError) {
          console.error('Error fetching order:', fetchError);
          throw fetchError;
        }

        if (!order) {
          console.error('No order found for payment:', paymentIntent.id);
          throw new Error('Order not found');
        }

        // Confirm the order
        const { error: confirmError } = await supabase.rpc('confirm_order_transaction', {
          p_order_id: order.id
        });

        if (confirmError) {
          console.error('Error confirming order:', confirmError);
          throw confirmError;
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = stripeEvent.data.object;
        console.log('Payment failed:', paymentIntent.id);
        
        // Update order status to cancelled
        const { error } = await supabase.rpc('update_stripe_payment_status', {
          p_payment_id: paymentIntent.id,
          p_status: 'cancelled'
        });

        if (error) {
          console.error('Error updating failed status:', error);
          throw error;
        }
        break;
      }

      default:
        console.log('Unhandled event type:', stripeEvent.type);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (err) {
    console.error('Webhook error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Webhook handler failed',
        details: err.message 
      }),
    };
  }
}; 