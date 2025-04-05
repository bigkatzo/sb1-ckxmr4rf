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
      case 'payment_intent.created': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent created:', paymentIntent.id);
        
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

      case 'payment_intent.processing': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment processing for intent:', paymentIntent.id);
        
        // Ensure order is in pending_payment status
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

        // First update the order status to confirmed
        const { error: confirmError } = await supabase.rpc('update_stripe_payment_status', {
          p_payment_id: paymentIntent.id,
          p_status: 'confirmed'
        });

        if (confirmError) {
          console.error('Error confirming payment:', confirmError);
          return res.status(500).json({ error: 'Failed to confirm payment' });
        }

        // Then update the transaction signature if we have charge details
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

        console.log('Successfully confirmed payment for order');
        break;
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