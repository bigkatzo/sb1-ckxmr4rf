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
          .select('id')
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

        // Confirm the order
        const { error: confirmError } = await supabase.rpc('confirm_order_transaction', {
          p_order_id: orders.id
        });

        if (confirmError) {
          console.error('Error confirming order:', confirmError);
          return res.status(500).json({ error: 'Failed to confirm order' });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        // Update order status to cancelled
        const { error: updateError } = await supabase.rpc('update_stripe_payment_status', {
          p_payment_id: paymentIntent.id,
          p_status: 'cancelled'
        });

        if (updateError) {
          console.error('Error updating failed payment:', updateError);
          return res.status(500).json({ error: 'Failed to update payment status' });
        }
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