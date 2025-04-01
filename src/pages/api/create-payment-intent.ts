import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { supabase } from '../../lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, productName, shippingInfo, productId, variants } = req.body;

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        productName,
        customerName: shippingInfo.fullName,
        shippingAddress: JSON.stringify(shippingInfo.shipping_address),
        contactInfo: JSON.stringify(shippingInfo.contact_info),
      },
    });

    // Create a draft order
    const { data: orderId, error: orderError } = await supabase.rpc('create_order', {
      p_product_id: productId,
      p_variants: variants || [],
      p_shipping_info: {
        shipping_address: shippingInfo.shipping_address,
        contact_info: shippingInfo.contact_info,
      },
      p_wallet_address: 'stripe', // Use 'stripe' as wallet address for Stripe payments
    });

    if (orderError) {
      throw orderError;
    }

    // Update order with payment intent ID as transaction signature
    const { error: updateError } = await supabase.rpc('update_order_transaction', {
      p_order_id: orderId,
      p_transaction_signature: paymentIntent.id,
      p_amount_sol: amount, // Store the SOL amount for reference
    });

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      orderId: orderId,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    return res.status(500).json({ 
      error: 'Failed to create payment intent' 
    });
  }
} 