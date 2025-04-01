const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Initialize Stripe
console.log('Initializing Stripe...');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

// Initialize Supabase
console.log('Initializing Supabase...');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event, context) => {
  console.log('Function invoked with method:', event.httpMethod);
  
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    console.log('Handling CORS preflight request');
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
    console.log('Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('Parsing request body...');
    const { amount, productName, shippingInfo, productId, variants } = JSON.parse(event.body);
    console.log('Request data:', { amount, productName, productId, variants: !!variants });

    // Create a payment intent
    console.log('Creating Stripe payment intent...');
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
    console.log('Payment intent created:', paymentIntent.id);

    // Create a draft order
    console.log('Creating draft order in Supabase...');
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
      console.error('Error creating order:', orderError);
      throw orderError;
    }
    console.log('Order created:', orderId);

    // Update order with payment intent ID as transaction signature
    console.log('Updating order with payment intent...');
    const { error: updateError } = await supabase.rpc('update_order_transaction', {
      p_order_id: orderId,
      p_transaction_signature: paymentIntent.id,
      p_amount_sol: amount, // Store the SOL amount for reference
    });

    if (updateError) {
      console.error('Error updating order:', updateError);
      throw updateError;
    }
    console.log('Order updated successfully');

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
  } catch (err) {
    console.error('Error in create-payment-intent:', err);
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Failed to create payment intent',
        details: err.message,
        type: err.name
      }),
    };
  }
}; 