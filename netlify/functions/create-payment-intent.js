const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Generate a user-friendly order number (shared with create-batch-order.js to ensure consistency)
const generateOrderNumber = async () => {
  try {
    // Get the current highest order number
    const { data, error } = await supabase
      .from('orders')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error getting latest order number:', error);
      // Fallback to a simpler format with timestamp
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      // Format: SF-MMDD-XXXX (e.g., SF-0415-1234)
      return `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    
    // If no orders exist, start with a sequential number
    if (!data || data.length === 0 || !data[0].order_number) {
      return 'SF-1001';
    }
    
    // Extract current highest order number
    const currentNumber = data[0].order_number;
    
    // Check if it's our standard format starting with SF-
    if (currentNumber.startsWith('SF-')) {
      // If it's our short format (SF-XXXX), increment
      if (/^SF-\d+$/.test(currentNumber)) {
        const numPart = currentNumber.split('-')[1];
        const nextNum = parseInt(numPart, 10) + 1;
        return `SF-${nextNum}`;
      }
      
      // If it's our date format (SF-MMDD-XXXX), create a new one with today's date
      if (/^SF-\d{4}-\d{4}$/.test(currentNumber)) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        // Format: SF-MMDD-XXXX (e.g., SF-0415-1234)
        return `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }
    
    // For any other format, or if we can't parse the existing format, 
    // default to our date-based format to ensure consistency
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
  } catch (err) {
    console.error('Error generating order number:', err);
    // If anything fails, use a timestamp-based fallback that matches our SF- pattern
    const now = new Date();
    const timestamp = now.getTime().toString().slice(-6);
    return `SF-${timestamp}`;
  }
};

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

    // For free orders, tell client to use create-order directly
    if (is100PercentDiscount) {
      console.log('Stripe - Free order detected (100% discount)');
      
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'Free orders should be processed directly via the create-order endpoint',
          code: 'FREE_ORDER',
          isFreeOrder: true
        })
      };
    }

    // Regular payment flow for non-free orders
    // Calculate USD amount, ensuring minimum of $0.50
    const usdAmount = Math.max(solAmount * solPrice, 0.50);
    const amountInCents = Math.round(usdAmount * 100);

    // Generate order number and batch ID for consistent naming
    const orderNumber = await generateOrderNumber();
    const batchOrderId = uuidv4();

    // Create a draft order with payment method info
    const finalPaymentMetadata = {
      ...paymentMetadata,
      paymentMethod: 'stripe',
      couponCode,
      couponDiscount,
      originalPrice,
      batchOrderId,
      isBatchOrder: paymentMetadata.isBatchOrder || false,
      isSingleItemOrder: paymentMetadata.isSingleItemOrder || true
    };
    
    // Create the order first, before creating the payment intent
    console.log('Creating order record in database before payment intent');
    const { data: orderId, error: orderError } = await supabase.rpc('create_order', {
      p_product_id: productId,
      p_variants: variants || [],
      p_shipping_info: shippingInfo,
      p_wallet_address: walletAddress || 'stripe',
      p_payment_metadata: finalPaymentMetadata
    });

    if (orderError) {
      console.error('Error creating order:', orderError);
      throw orderError;
    }

    console.log('Order created successfully with ID:', orderId);

    // Update order with batch ID and order number
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        order_number: orderNumber,
        batch_order_id: batchOrderId,
        item_index: 1, // For single orders, always index 1
        total_items_in_batch: 1, // For single orders, always 1 item
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order with batch details:', updateError);
      throw updateError;
    }

    // IMPORTANT: Stripe metadata must be flat key-value pairs with string values only
    // Carefully prepare metadata without circular references or complex objects
    // Truncate long values to stay under Stripe's metadata limits
    
    // Simplified shipping address
    const simplifiedAddress = {
      address: shippingInfo.shipping_address.address || '',
      city: shippingInfo.shipping_address.city || '',
      country: shippingInfo.shipping_address.country || '',
      zip: shippingInfo.shipping_address.zip || ''
    };
    
    // Simplified contact info
    const simplifiedContact = {
      method: shippingInfo.contact_info.method || 'email',
      value: shippingInfo.contact_info.value || '',
      firstName: shippingInfo.contact_info.firstName || '',
      lastName: shippingInfo.contact_info.lastName || ''
    };
    
    // Create metadata object with string values only
    const stripeMetadata = {
      productName: String(productName || '').substring(0, 100),
      customerName: `${simplifiedContact.firstName} ${simplifiedContact.lastName}`.substring(0, 100),
      addressStr: JSON.stringify(simplifiedAddress).substring(0, 100),
      contactStr: JSON.stringify(simplifiedContact).substring(0, 100),
      solAmount: String(solAmount || 0),
      solPrice: String(solPrice || 0),
      walletAddress: String(walletAddress || 'stripe').substring(0, 100),
      orderId: String(orderId || ''),
      batchOrderId: String(batchOrderId || ''),
      orderNumber: String(orderNumber || '')
    };

    console.log('Creating Stripe payment intent with metadata:', stripeMetadata);

    // Create a payment intent with the simplified metadata
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: stripeMetadata,
      });
      
      console.log('Payment intent created successfully:', {
        id: paymentIntent.id,
        hasMetadata: !!paymentIntent.metadata,
        metadataKeys: Object.keys(paymentIntent.metadata || {})
      });
      
      // VERIFICATION STEP: Retrieve the payment intent to ensure metadata was saved
      const retrievedIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
      
      if (!retrievedIntent.metadata || Object.keys(retrievedIntent.metadata).length === 0) {
        console.error('Metadata verification failed - missing metadata on payment intent:', {
          intentId: paymentIntent.id,
          retrievedMetadata: retrievedIntent.metadata
        });
        
        // Try to update the payment intent with metadata again
        try {
          console.log('Attempting to re-attach metadata to payment intent');
          await stripe.paymentIntents.update(paymentIntent.id, { metadata: stripeMetadata });
          
          // Verify again
          const reVerifiedIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
          console.log('Metadata re-verification result:', {
            success: !!(reVerifiedIntent.metadata && Object.keys(reVerifiedIntent.metadata).length > 0),
            metadataKeys: Object.keys(reVerifiedIntent.metadata || {})
          });
        } catch (metadataUpdateError) {
          console.error('Failed to update metadata on payment intent:', metadataUpdateError);
        }
      } else {
        console.log('Metadata verification successful:', {
          orderId: retrievedIntent.metadata.orderId,
          metadataCount: Object.keys(retrievedIntent.metadata).length
        });
      }

      // Now that the payment intent is created, update the order with the payment intent ID
      console.log('Updating order with payment intent ID:', paymentIntent.id);
      const { error: paymentUpdateError } = await supabase
        .from('orders')
        .update({
          transaction_signature: paymentIntent.id,
          amount_sol: solAmount, // Store the SOL amount for reference
          status: 'pending_payment' // Update status from draft to pending_payment
        })
        .eq('id', orderId);

      if (paymentUpdateError) {
        console.error('Error updating order with payment intent ID:', paymentUpdateError);
        // Don't throw here, we still want to return the client secret
        // The payment can still be processed and the order will be updated later
        console.warn('Payment intent created but order not updated - will be fixed during payment confirmation');
      }

      // Return the payment intent data and order information
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          orderId: orderId,
          orderNumber: orderNumber,
          batchOrderId: batchOrderId,
          paymentIntentId: paymentIntent.id,
          success: true,
          // Match batch order format
          orders: [
            {
              orderId,
              orderNumber: orderNumber,
              status: 'pending_payment',
              itemIndex: 1,
              totalItems: 1
            }
          ]
        }),
      };
    } catch (stripeError) {
      console.error('Error creating payment intent with Stripe:', stripeError);
      
      // If we created an order but failed to create a payment intent, 
      // mark the order as failed to prevent orphaned orders
      try {
        await supabase
          .from('orders')
          .update({
            status: 'error',
            transaction_signature: `error_${Date.now()}`
          })
          .eq('id', orderId);
      } catch (cleanupError) {
        console.error('Failed to mark order as error after payment intent failure:', cleanupError);
      }
      
      throw stripeError;
    }
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