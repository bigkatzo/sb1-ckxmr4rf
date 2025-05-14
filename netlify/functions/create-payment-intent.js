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
      cartItems,          // New parameter for cart items
      isCartCheckout,     // Flag to indicate if this is coming from cart
      paymentMetadata = {},
      existingOrderId    // New parameter to pass an existing order ID
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
      walletAddress: walletAddress || 'stripe',
      isCartCheckout,
      hasCartItems: !!cartItems?.length
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
      isBatchOrder: isCartCheckout || paymentMetadata.isBatchOrder || false,
      isSingleItemOrder: !isCartCheckout && (paymentMetadata.isSingleItemOrder || true)
    };
    
    let orderId;
    
    // If an existing order ID was provided, use it instead of creating a new order
    if (existingOrderId) {
      console.log('Using existing order ID:', existingOrderId);
      orderId = existingOrderId;
      
      // Look up the batch order ID and order number for the existing order
      const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select('id, order_number, batch_order_id')
        .eq('id', existingOrderId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching existing order:', fetchError);
        throw new Error('Failed to fetch existing order information');
      }
      
      if (existingOrder) {
        console.log('Found existing order details:', existingOrder);
        // Use the existing batch ID and order number
        orderNumber = existingOrder.order_number;
        batchOrderId = existingOrder.batch_order_id || batchOrderId;
        
        // Update order with payment information
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_metadata: finalPaymentMetadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingOrderId);
          
        if (updateError) {
          console.error('Error updating existing order with payment information:', updateError);
          // Continue anyway - not critical
        }
      } else {
        console.warn('Existing order not found in database:', existingOrderId);
        throw new Error('Order not found. Please try again.');
      }
    }
    // STOP creating new orders here - require an existing order ID
    else {
      console.error('No existing order ID provided');
      throw new Error('Missing required order ID. Please create an order before initiating payment.');
    }

    // IMPORTANT: Stripe metadata must be flat key-value pairs with string values only
    // Carefully prepare metadata without circular references or complex objects
    // Truncate long values to stay under Stripe's metadata limits
    
    // Simplified shipping address - keep only simple string fields
    const simplifiedAddress = {
      address: shippingInfo.shipping_address.address || '',
      city: shippingInfo.shipping_address.city || '',
      country: shippingInfo.shipping_address.country || '',
      zip: shippingInfo.shipping_address.zip || ''
    };
    
    // Simplified contact info - keep only simple string fields
    const simplifiedContact = {
      method: shippingInfo.contact_info.method || 'email',
      value: shippingInfo.contact_info.value || '',
      firstName: shippingInfo.contact_info.firstName || '',
      lastName: shippingInfo.contact_info.lastName || ''
    };
    
    // Create FLAT metadata object with string values only - no nested objects
    const stripeMetadata = {
      orderIdStr: String(orderId || ''),
      batchOrderIdStr: String(batchOrderId || ''),
      orderNumberStr: String(orderNumber || ''),
      productNameStr: String(productName || '').substring(0, 100),
      customerName: `${simplifiedContact.firstName} ${simplifiedContact.lastName}`.substring(0, 100),
      walletStr: String(walletAddress || 'stripe').substring(0, 100),
      amountStr: String(solAmount || 0),
      priceStr: String(solPrice || 0)
    };

    console.log('Creating Stripe payment intent with metadata:', stripeMetadata);
    console.log('ORDER ID TO BE INCLUDED IN METADATA:', orderId);

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
            metadataKeys: Object.keys(reVerifiedIntent.metadata || {}),
            hasOrderId: !!reVerifiedIntent.metadata?.orderIdStr
          });
        } catch (metadataUpdateError) {
          console.error('Failed to update metadata on payment intent:', metadataUpdateError);
        }
      } else {
        console.log('Metadata verification successful:', {
          orderId: retrievedIntent.metadata.orderIdStr,
          metadataCount: Object.keys(retrievedIntent.metadata).length
        });
      }

      // Now that the payment intent is created, update the order with the payment intent ID
      if (isCartCheckout && cartItems && cartItems.length > 0) {
        // For cart checkout, update all orders in the batch
        console.log(`Updating all orders in batch ${batchOrderId} with payment intent ID:`, paymentIntent.id);
        
        const { error: batchUpdateError } = await supabase
          .from('orders')
          .update({
            transaction_signature: paymentIntent.id,
            amount_sol: solAmount / cartItems.length, // Divide amount among items
            status: 'pending_payment' // Update status from draft to pending_payment
          })
          .eq('batch_order_id', batchOrderId);
          
        if (batchUpdateError) {
          console.error('Error updating batch orders with payment intent ID:', batchUpdateError);
          console.warn('Payment intent created but batch orders not updated - will be fixed during payment confirmation');
        } else {
          console.log(`Successfully updated all orders in batch ${batchOrderId} with payment intent ID`);
        }
      } else {
        // For single product checkout, update just the one order
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
      }

      // Before returning, get order IDs for any cart checkout to ensure we can send correct IDs back
      let orderIds = [];
      if (isCartCheckout && cartItems && cartItems.length > 0) {
        try {
          const { data: batchOrders, error: fetchError } = await supabase
            .from('orders')
            .select('id, order_number, status, item_index, total_items_in_batch')
            .eq('batch_order_id', batchOrderId)
            .order('item_index', { ascending: true });
            
          if (!fetchError && batchOrders && batchOrders.length > 0) {
            orderIds = batchOrders.map(order => ({
              orderId: order.id,
              orderNumber: order.order_number,
              status: order.status,
              itemIndex: order.item_index,
              totalItems: order.total_items_in_batch
            }));
            console.log(`Retrieved ${orderIds.length} order IDs for batch ${batchOrderId}`);
          }
        } catch (fetchError) {
          console.warn('Error fetching batch order IDs:', fetchError);
          // Continue without the IDs, not critical
        }
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
          // Match batch order format - if we have orderIds from a batch, use them, otherwise create a single-item array
          orders: orderIds.length > 0 ? orderIds : [
            {
              orderId,
              orderNumber: orderNumber,
              status: 'pending_payment',
              itemIndex: 1,
              totalItems: isCartCheckout ? cartItems.length : 1
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