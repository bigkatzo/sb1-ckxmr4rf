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

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
        'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { solAmount, solPrice, productName, shippingInfo, productId, variants, walletAddress } = JSON.parse(event.body);

    // Calculate USD amount, ensuring minimum of $0.50
    const usdAmount = Math.max(solAmount * solPrice, 0.50);
    const amountInCents = Math.round(usdAmount * 100);

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        productName,
        customerName: shippingInfo.contact_info.fullName,
        shippingAddress: JSON.stringify(shippingInfo.shipping_address),
        contactInfo: JSON.stringify(shippingInfo.contact_info),
        solAmount: solAmount.toString(),
        solPrice: solPrice.toString(),
        walletAddress: walletAddress || 'stripe', // Store wallet address in metadata
      },
    });

    // Create a draft order
    const { data: orderId, error: orderError } = await supabase.rpc('create_order', {
      p_product_id: productId,
      p_variants: variants || [],
      p_shipping_info: shippingInfo,
      p_wallet_address: walletAddress || 'stripe', // Use wallet address when available
    });

    if (orderError) {
      throw orderError;
    }

    // Update order with payment intent ID as transaction signature
    const { error: updateError } = await supabase.rpc('update_order_transaction', {
      p_order_id: orderId,
      p_transaction_signature: paymentIntent.id,
      p_amount_sol: solAmount, // Store the SOL amount for reference
    });

    if (updateError) {
      throw updateError;
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        orderId: orderId,
        paymentIntentId: paymentIntent.id,
      }),
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to create payment intent',
        details: error.message,
      }),
    };
  }
}; 