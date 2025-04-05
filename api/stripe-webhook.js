const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
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
      case 'payment_intent.created': {
        const paymentIntent = stripeEvent.data.object;
        console.log('Payment intent created:', paymentIntent.id);
        
        // Update order status to pending_payment
        const { error } = await supabase.rpc('update_stripe_payment_status', {
          p_payment_id: paymentIntent.id,
          p_status: 'pending_payment'
        });

        if (error) {
          console.error('Error updating to pending_payment status:', error);
          throw error;
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = stripeEvent.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        
        try {
          // Get order ID for this payment intent
          const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('id, status')
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

          console.log('Found order:', order.id, 'with status:', order.status);

          // Use the Stripe-specific function to confirm the payment
          // This will handle both draft->pending_payment and pending_payment->confirmed transitions
          const { error: confirmError } = await supabase.rpc('confirm_stripe_payment', {
            p_payment_id: paymentIntent.id
          });

          if (confirmError) {
            console.error('Error confirming payment:', confirmError);
            throw confirmError;
          }

          // Verify the order status was updated
          const { data: confirmedOrder, error: verifyError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('transaction_signature', paymentIntent.id)
            .single();

          if (verifyError || !confirmedOrder) {
            console.error('Error verifying order status:', verifyError);
            throw verifyError || new Error('Could not verify order status');
          }

          console.log('Payment confirmed successfully for order:', confirmedOrder.id, 'new status:', confirmedOrder.status);
        } catch (error) {
          console.error('Failed to process payment webhook:', error);
          return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to process payment webhook' })
          };
        }
        break;
      }

      default:
        // Log any other events but don't change order status
        console.log('Unhandled event type:', stripeEvent.type);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
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