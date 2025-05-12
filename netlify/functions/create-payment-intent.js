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
    const { 
      solAmount, 
      solPrice, 
      productName, 
      shippingInfo, 
      productId, 
      variants, 
      walletAddress,
      couponCode,
      couponDiscount,
      originalPrice,
      paymentMetadata = {}
    } = JSON.parse(event.body);

    // Check if this is a free order (100% discount)
    const is100PercentDiscount = 
      couponDiscount !== undefined && 
      originalPrice !== undefined && 
      couponDiscount > 0 && (
        couponDiscount >= originalPrice || 
        (originalPrice > 0 && (couponDiscount / originalPrice) * 100 >= 100)
      );
    
    console.log('Payment details:', {
      productId,
      solAmount,
      originalPrice,
      couponDiscount,
      is100PercentDiscount,
      walletAddress: walletAddress || 'stripe'
    });

    // Special handling for free orders (100% discount)
    if (is100PercentDiscount) {
      console.log('Processing free order with 100% discount - forwarding to create-order endpoint');
      
      // Generate a consistent transaction ID for free orders
      const transactionId = `free_stripe_${productId}_${couponCode || 'nocoupon'}_${walletAddress || 'stripe'}_${paymentMetadata.timestamp || Date.now()}`;
      
      // Forward to create-order endpoint for consistent handling of free orders
      try {
        // Prepare the request body for create-order endpoint
        const createOrderBody = {
          productId,
          variants,
          shippingInfo,
          walletAddress: walletAddress || 'anonymous',
          paymentMetadata: {
            ...paymentMetadata,
            paymentMethod: 'free_stripe',
            couponCode,
            couponDiscount,
            originalPrice,
            isFreeOrder: true,
            transactionId
          }
        };
        
        // Import the create-order handler
        const createOrderHandler = require('./create-order');
        
        // Call the create-order handler directly
        const result = await createOrderHandler.handler({
          httpMethod: 'POST',
          body: JSON.stringify(createOrderBody)
        }, context);
        
        // Parse the response
        const createOrderResponse = JSON.parse(result.body);
        
        console.log('Free order creation result:', {
          statusCode: result.statusCode,
          isDuplicate: !!createOrderResponse.isDuplicate,
          orderId: createOrderResponse.orderId
        });
        
        // Return the result directly
        return {
          statusCode: result.statusCode,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: result.body
        };
      } catch (error) {
        console.error('Error forwarding to create-order:', error);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            error: 'Failed to process free order',
            details: error.message
          })
        };
      }
    }

    // Regular payment flow for non-free orders
    // Calculate USD amount, ensuring minimum of $0.50
    const usdAmount = Math.max(solAmount * solPrice, 0.50);
    const amountInCents = Math.round(usdAmount * 100);

    // Ensure payment method is included in metadata
    const stripeMetadata = {
      productName,
      customerName: shippingInfo.contact_info.fullName,
      shippingAddress: JSON.stringify(shippingInfo.shipping_address),
      contactInfo: JSON.stringify(shippingInfo.contact_info),
      solAmount: solAmount.toString(),
      solPrice: solPrice.toString(),
      walletAddress: walletAddress || 'stripe', // Store wallet address in metadata
    };

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: stripeMetadata,
    });

    // Create a draft order with payment method info
    const finalPaymentMetadata = {
      ...paymentMetadata,
      paymentMethod: 'stripe',
      couponCode,
      couponDiscount,
      originalPrice
    };
    
    const { data: orderId, error: orderError } = await supabase.rpc('create_order', {
      p_product_id: productId,
      p_variants: variants || [],
      p_shipping_info: shippingInfo,
      p_wallet_address: walletAddress || 'stripe',
      p_payment_metadata: finalPaymentMetadata
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