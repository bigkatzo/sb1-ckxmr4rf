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
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
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
    const { solAmount, solPrice, productName, shippingInfo, productId, variants, walletAddress } = JSON.parse(event.body);
    console.log('Request data:', { 
      solAmount,
      solPrice, 
      productName, 
      productId, 
      variants: !!variants,
      shippingInfo
    });

    // Ensure shippingInfo is properly formatted
    const parsedShippingInfo = typeof shippingInfo === 'string' ? JSON.parse(shippingInfo) : shippingInfo;

    // Convert SOL to USD
    console.log('Converting SOL to USD...');
    console.log('Amount in SOL:', solAmount);
    console.log('SOL price in USD:', solPrice);
    const amountInUSD = solAmount * solPrice;
    const MINIMUM_USD_AMOUNT = 0.50;
    
    // Adjust amount if below minimum
    const finalAmountInUSD = Math.max(amountInUSD, MINIMUM_USD_AMOUNT);
    const amountInCents = Math.round(finalAmountInUSD * 100);
    
    console.log('Original amount in USD:', amountInUSD);
    console.log('Final amount in USD:', finalAmountInUSD);
    console.log('Amount in cents:', amountInCents);

    // Validate minimum amount
    if (finalAmountInUSD < MINIMUM_USD_AMOUNT) {
      throw new Error(`Amount must be at least $${MINIMUM_USD_AMOUNT} usd`);
    }

    // Create a payment intent
    console.log('Creating Stripe payment intent...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        productName,
        solAmount: solAmount.toString(),
        solPrice: solPrice.toString(),
        usdAmount: finalAmountInUSD.toString(),
        customerName: parsedShippingInfo.contact_info.fullName,
        shippingAddress: JSON.stringify(parsedShippingInfo.shipping_address),
        contactInfo: JSON.stringify(parsedShippingInfo.contact_info),
      },
    });
    console.log('Payment intent created:', paymentIntent.id);

    // Create a draft order
    console.log('Creating draft order in Supabase...');
    const { data: orderId, error: orderError } = await supabase.rpc('create_order', {
      p_product_id: productId,
      p_variants: variants || [],
      p_shipping_info: parsedShippingInfo,
      p_wallet_address: walletAddress || 'stripe' // Use connected wallet or fallback to 'stripe'
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
      p_amount_sol: solAmount, // Store the original SOL amount
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