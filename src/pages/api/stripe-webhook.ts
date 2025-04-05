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
        // Update order status to processing
        await supabase.rpc('update_stripe_payment_status', {
          p_payment_id: paymentIntent.id,
          p_status: 'processing'
        });
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Get order ID for this payment intent
        const { data: orders, error: fetchError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('transaction_signature', paymentIntent.id)
          .single();

        if (fetchError) {
          console.error('Error fetching order:', fetchError);
          return res.status(500).json({ error: 'Failed to fetch order' });
        }

        if (!orders) {
          console.error('No order found for payment intent:', paymentIntent.id);
          return res.status(404).json({ error: 'Order not found' });
        }

        // First ensure order is in pending_payment status
        if (orders.status === 'draft') {
          const { error: updateError } = await supabase.rpc('update_order_transaction', {
            p_order_id: orders.id,
            p_transaction_signature: paymentIntent.id,
            p_amount_sol: paymentIntent.metadata.solAmount || 0
          });

          if (updateError) {
            console.error('Error updating order to pending_payment:', updateError);
            return res.status(500).json({ error: 'Failed to update order status' });
          }
        }

        // Then confirm the order if it's in pending_payment status
        if (orders.status === 'pending_payment' || orders.status === 'draft') {
          const { error: confirmError } = await supabase.rpc('confirm_order_transaction', {
            p_order_id: orders.id
          });

          if (confirmError) {
            console.error('Error confirming order:', confirmError);
            return res.status(500).json({ error: 'Failed to confirm order' });
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Get order ID for this payment intent
        const { data: orders, error: fetchError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('transaction_signature', paymentIntent.id)
          .single();

        if (fetchError || !orders) {
          console.error('Error fetching order:', fetchError);
          return res.status(500).json({ error: 'Failed to fetch order' });
        }

        // If order is still in draft, move it to pending_payment
        if (orders.status === 'draft') {
          const { error: updateError } = await supabase.rpc('update_order_transaction', {
            p_order_id: orders.id,
            p_transaction_signature: paymentIntent.id,
            p_amount_sol: paymentIntent.metadata.solAmount || 0
          });

          if (updateError) {
            console.error('Error updating to pending_payment status:', updateError);
            return res.status(500).json({ error: 'Failed to update order status' });
          }
        }

        // Log the payment failure in transaction logs if you have such a table
        // This is where you would log the failure details for merchant review
        console.error('Payment failed for order:', {
          orderId: orders.id,
          paymentIntentId: paymentIntent.id,
          error: paymentIntent.last_payment_error
        });

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