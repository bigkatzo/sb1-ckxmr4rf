import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { supabase } from '../../lib/supabase';

// Disable body parsing, need raw body for Stripe webhook
export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature']!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.processing': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Update order status to pending_payment
        const { error: updateError } = await supabase.rpc('update_stripe_payment_status', {
          p_payment_id: paymentIntent.id,
          p_status: 'pending_payment'
        });

        if (updateError) {
          console.error('Error updating to pending_payment status:', updateError);
          return res.status(500).json({ error: 'Failed to update order status' });
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Processing successful payment for intent:', paymentIntent.id);
        
        try {
          // First verify the order exists and is in pending_payment status
          const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('transaction_signature', paymentIntent.id)
            .single();

          if (orderError) {
            console.error('Error fetching order:', orderError);
            return res.status(500).json({ error: 'Failed to fetch order details' });
          }

          if (!order) {
            console.error('No order found for payment intent:', paymentIntent.id);
            return res.status(404).json({ error: 'Order not found' });
          }

          console.log('Found order:', order.id, 'Current status:', order.status);

          if (order.status !== 'pending_payment') {
            console.log('Order not in pending_payment status:', order.id, 'Current status:', order.status);
            return res.json({ received: true }); // Already processed, return success
          }

          // Get the charge details from the payment intent
          let receiptUrl: string | null = null;
          let chargeId: string | null = null;
          try {
            const charges = await stripe.charges.list({
              payment_intent: paymentIntent.id,
              limit: 1
            });
            const charge = charges.data[0];
            if (charge) {
              receiptUrl = charge.receipt_url || null;
              chargeId = charge.id;
              console.log('Found charge ID:', chargeId, 'and receipt URL:', receiptUrl);
            }
          } catch (err) {
            console.error('Failed to fetch charge details:', err);
            // Continue with confirmation even if charge details fetch fails
          }

          // First confirm the payment using the payment intent ID
          const { error: confirmError } = await supabase.rpc('confirm_stripe_payment', {
            p_payment_id: paymentIntent.id
          });

          if (confirmError) {
            console.error('Error confirming payment:', confirmError);
            // Try one more time with charge ID if available
            if (chargeId) {
              console.log('Retrying confirmation with charge ID:', chargeId);
              const { error: retryError } = await supabase.rpc('confirm_stripe_payment', {
                p_payment_id: chargeId
              });
              
              if (retryError) {
                console.error('Error confirming payment with charge ID:', retryError);
                return res.status(500).json({ error: 'Failed to confirm payment' });
              }
            } else {
              return res.status(500).json({ error: 'Failed to confirm payment' });
            }
          }

          // Verify the order was actually confirmed
          const { data: confirmedOrder, error: verifyError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('transaction_signature', paymentIntent.id)
            .single();

          if (verifyError) {
            console.error('Error verifying order confirmation:', verifyError);
            return res.status(500).json({ error: 'Failed to verify order confirmation' });
          }

          if (!confirmedOrder) {
            console.error('Order not found after confirmation attempt');
            return res.status(500).json({ error: 'Order not found after confirmation' });
          }

          console.log('Order status after confirmation:', confirmedOrder.status);

          if (confirmedOrder.status !== 'confirmed') {
            console.error('Order not confirmed after confirmation attempt. Current status:', confirmedOrder.status);
            return res.status(500).json({ error: 'Order confirmation failed' });
          }

          // If we have charge details, update them
          if (chargeId && receiptUrl) {
            const { error: updateError } = await supabase.rpc('update_stripe_payment_signature', {
              p_payment_id: paymentIntent.id,
              p_charge_id: chargeId,
              p_receipt_url: receiptUrl
            });

            if (updateError) {
              console.error('Error updating transaction signature:', updateError);
              // Don't fail the webhook, the order is already confirmed
            }
          }

          console.log('Successfully confirmed payment for order:', confirmedOrder.id);
          break;
        } catch (err) {
          console.error('Error processing payment confirmation:', err);
          return res.status(500).json({ error: 'Failed to process payment confirmation' });
        }
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const errorMessage = paymentIntent.last_payment_error?.message || 'Payment failed';
        
        // Handle failed payment using Stripe-specific function
        const { error: failError } = await supabase.rpc('fail_stripe_payment', {
          p_payment_id: paymentIntent.id,
          p_error: errorMessage
        });

        if (failError) {
          console.error('Error handling failed payment:', failError);
          return res.status(500).json({ error: 'Failed to handle payment failure' });
        }

        console.log('Payment failure handled for intent:', paymentIntent.id);
        break;
      }

      // Only log other events for monitoring
      default:
        console.log(`Received event: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
} 