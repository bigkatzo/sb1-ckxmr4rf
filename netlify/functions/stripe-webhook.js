/**
 * STRIPE WEBHOOK HANDLER
 * 
 * This is the primary webhook handler for all Stripe events.
 * The Next.js API route for webhooks has been deprecated in favor of this Netlify function.
 */

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

          // Get the receipt URL from the charge
          try {
            // Get the charge details from Stripe
            const charges = await stripe.charges.list({
              payment_intent: paymentIntent.id,
              limit: 1
            });
            
            // Extract charge ID and receipt URL
            if (charges.data.length > 0) {
              const charge = charges.data[0];
              const chargeId = charge.id;
              const receiptUrl = charge.receipt_url;
              
              console.log('Found charge details:', { chargeId, receiptUrl });

              if (chargeId && receiptUrl) {
                // Update the transaction signature to use the receipt URL
                const { error: signatureError } = await supabase.rpc('update_stripe_payment_signature', {
                  p_payment_id: paymentIntent.id,
                  p_charge_id: chargeId,
                  p_receipt_url: receiptUrl
                });

                if (signatureError) {
                  console.error('Error updating transaction signature:', signatureError);
                  // Continue processing since payment is confirmed
                } else {
                  console.log('Updated transaction signature to receipt URL:', receiptUrl);
                }
              }
            }
          } catch (stripeError) {
            console.error('Error fetching charge details:', stripeError);
            // Continue processing since payment is confirmed
          }

          // Verify the order status was updated
          const { data: confirmedOrder, error: verifyError } = await supabase
            .from('orders')
            .select('id, status, transaction_signature')
            .eq('id', order.id)
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

      case 'payment_intent.payment_failed': {
        const paymentIntent = stripeEvent.data.object;
        console.log('Payment failed:', paymentIntent.id);
        const errorMessage = paymentIntent.last_payment_error?.message || 'Unknown payment error';
        const errorCode = paymentIntent.last_payment_error?.code || 'unknown_error';
        
        try {
          // Store more detailed error information
          const paymentErrorDetails = {
            code: errorCode,
            message: errorMessage,
            payment_method_type: paymentIntent.last_payment_error?.payment_method?.type || null,
            decline_code: paymentIntent.last_payment_error?.decline_code || null,
            timestamp: new Date().toISOString()
          };
          
          // Get the order for this payment intent
          const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('id, payment_metadata')
            .eq('transaction_signature', paymentIntent.id)
            .single();
            
          if (fetchError) {
            console.error('Error fetching order for failed payment:', fetchError);
          } else if (order) {
            console.log('Found order for failed payment:', order.id);
            
            // Update payment metadata with error details for potential recovery
            const updatedMetadata = {
              ...order.payment_metadata,
              payment_error: paymentErrorDetails,
              retry_eligible: ['authentication_required', 'insufficient_funds', 'card_declined'].includes(errorCode)
            };
            
            // Update order metadata
            const { error: metadataError } = await supabase
              .from('orders')
              .update({ payment_metadata: updatedMetadata })
              .eq('id', order.id);
              
            if (metadataError) {
              console.error('Error updating payment metadata:', metadataError);
            }
          }
          
          // Update the payment status to failed
          const { error } = await supabase.rpc('fail_stripe_payment', {
            p_payment_id: paymentIntent.id,
            p_error: errorMessage
          });

          if (error) {
            console.error('Error handling failed payment:', error);
            throw error;
          }
          
          console.log('Payment failure handled for intent:', paymentIntent.id);
        } catch (error) {
          console.error('Failed to process payment failure webhook:', error);
          return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to process payment failure webhook' })
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