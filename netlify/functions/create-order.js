/**
 * CREATE ORDER
 * 
 * Server-side function for creating orders with proper validation
 * Uses service role credentials to access database functions
 */

const { createClient } = require('@supabase/supabase-js');

// Environment variables
const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
};

// Initialize Supabase with service role credentials
let supabase;
try {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in environment variables');
  } else {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase client initialized with service role permissions');
  }
} catch (err) {
  console.error('Failed to initialize Supabase client:', err.message);
}

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check if Supabase client is available
  if (!supabase) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Database connection unavailable' })
    };
  }

  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  // Validate required parameters
  const { productId, shippingInfo, walletAddress, paymentMetadata = {} } = body;
  const variants = body.variants || [];

  console.log('Create order request:', {
    productId,
    walletAddress,
    hasShippingInfo: !!shippingInfo,
    variants: Array.isArray(variants) ? variants.length : 'not an array',
    paymentMetadata: {
      ...paymentMetadata,
      transactionId: paymentMetadata.transactionId || 'none'
    }
  });

  if (!productId || !shippingInfo) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required parameters' })
    };
  }

  // Check for free order with 100% discount
  const isFreeOrder = 
    // Explicitly marked as free
    (paymentMetadata.isFreeOrder === true) ||
    // Has payment method that indicates free
    (paymentMetadata.paymentMethod && 
      (paymentMetadata.paymentMethod.startsWith('free_'))) ||
    // Has 100% discount
    (paymentMetadata.couponDiscount && 
     paymentMetadata.originalPrice && 
     paymentMetadata.couponDiscount >= paymentMetadata.originalPrice);

  // Generate a unique ID for this transaction to prevent duplicates
  let transactionId;
  let transactionSignature;
  
  if (isFreeOrder) {
    // Determine the payment source (stripe or token)
    const paymentMethod = (paymentMetadata.paymentMethod || '').toLowerCase();
    
    // Choose payment source based on the payment method
    let paymentSource = 'unknown';
    if (paymentMethod.includes('stripe') || paymentMethod === 'coupon' || paymentMethod === 'free_stripe') {
      paymentSource = 'stripe';
    } else if (paymentMethod.includes('token') || paymentMethod === 'free_token') {
      paymentSource = 'token';
    } else if (paymentMethod.includes('solana')) {
      paymentSource = 'solana';
    }
    
    // Create appropriate prefix based on payment source
    const prefix = `free_${paymentSource}_`;
    
    // Use existing transactionId if provided, or generate a new one
    if (paymentMetadata.transactionId && paymentMetadata.transactionId.startsWith('free_')) {
      transactionId = paymentMetadata.transactionId;
    } else {
      transactionId = `${prefix}${productId}_${paymentMetadata.couponCode || 'nocoupon'}_${walletAddress || paymentSource}_${Date.now()}`;
    }
    
    // Set the transaction signature - use the same as transactionId for free orders
    transactionSignature = transactionId;
  } else {
    // For non-free orders, just store the transactionId for later use
    transactionId = paymentMetadata.transactionId || 
      `order_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  
  console.log('Order transaction details:', {
    isFreeOrder,
    transactionId,
    transactionSignature,
    source: transactionId.includes('stripe') ? 'stripe' : 'token',
    paymentMethod: paymentMetadata.paymentMethod || 'unknown'
  });
  
  // Include transactionId in the metadata
  const finalPaymentMetadata = {
    ...paymentMetadata,
    transactionId
  };

  try {
    // If this is a free order, check if an order with this transaction ID already exists
    if (isFreeOrder) {
      console.log('Processing free order, checking for duplicates with transactionId:', transactionId);
      
      // First check if there's already an order with this transaction ID
      let { data: existingOrders, error: searchError } = await supabase
        .from('orders')
        .select('id, status, created_at, order_number')
        .eq('payment_metadata->transactionId', transactionId);
      
      // If no exact match found, try a more general search
      if ((!existingOrders || existingOrders.length === 0) && !searchError) {
        console.log('No exact duplicate found, checking for similar recent orders');
        
        // Get the current timestamp and calculate 5 minutes ago
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
        
        // Look for recent orders for the same product and wallet
        ({ data: existingOrders, error: searchError } = await supabase
          .from('orders')
          .select('id, status, created_at, order_number')
          .eq('product_id', productId)
          .eq('wallet_address', walletAddress)
          .gt('created_at', fiveMinutesAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(1));
      }
      
      if (searchError) {
        console.error('Error searching for duplicate orders:', searchError);
        // Continue with order creation even if search fails
      } else if (existingOrders && existingOrders.length > 0) {
        console.log('Found existing order:', {
          orderId: existingOrders[0].id,
          orderNumber: existingOrders[0].order_number,
          orderStatus: existingOrders[0].status,
          created: existingOrders[0].created_at,
          transactionId
        });
        
        // Return the existing order regardless of its status
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            orderId: existingOrders[0].id,
            orderNumber: existingOrders[0].order_number,
            status: existingOrders[0].status,
            isDuplicate: true
          })
        };
      } else {
        console.log('No duplicate orders found, proceeding with creation');
      }
    }

    console.log('Creating order with service role permissions');
    
    // Call create_order function with service role permissions
    const { data: orderId, error } = await supabase.rpc('create_order', {
      p_product_id: productId,
      p_variants: variants || {},
      p_shipping_info: shippingInfo,
      p_wallet_address: walletAddress,
      p_payment_metadata: finalPaymentMetadata
    });

    if (error) {
      console.error('Error creating order:', error);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error.message })
      };
    }

    console.log('Order created successfully:', {
      orderId,
      productId,
      isFreeOrder,
      transactionId,
      paymentMethod: finalPaymentMetadata.paymentMethod || 'unknown'
    });
    
    // For free orders, set the transaction signature and confirm immediately
    if (isFreeOrder && transactionSignature) {
      console.log('Setting transaction signature for free order:', transactionSignature);
      
      // Update transaction signature
      const { error: updateError } = await supabase.rpc('update_order_transaction', {
        p_order_id: orderId,
        p_transaction_signature: transactionSignature,
        p_amount_sol: 0
      });
      
      if (updateError) {
        console.error('Error updating free order transaction signature:', updateError);
        // Continue anyway - don't fail the entire request
      }
      
      // Confirm the order immediately since it's free
      const { error: confirmError } = await supabase.rpc('confirm_order_transaction', {
        p_order_id: orderId
      });
      
      if (confirmError) {
        console.error('Error confirming free order:', confirmError);
        // Continue anyway - don't fail the entire request
      } else {
        console.log('Free order confirmed successfully');
      }
    }
    
    // Get the order_number to include in the response
    const { data: orderDetails, error: fetchError } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', orderId)
      .single();
      
    if (fetchError) {
      console.warn('Could not fetch order number:', fetchError);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        orderId,
        orderNumber: orderDetails?.order_number,
        isFreeOrder,
        transactionId,
        transactionSignature: isFreeOrder ? transactionSignature : undefined,
        paymentIntentId: isFreeOrder ? transactionSignature : undefined
      })
    };
  } catch (err) {
    console.error('Error in create-order function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 