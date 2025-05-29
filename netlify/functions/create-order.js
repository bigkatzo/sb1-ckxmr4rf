/**
 * CREATE ORDER
 * 
 * Server-side function for creating orders with proper validation
 * Uses service role credentials to access database functions
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

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
    console.error('Error generating order number:', err.message);
    // Generate a unique fallback order number
    return `SF-${Date.now().toString().slice(-6)}`;
  }
};

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

  // Format variants to be consistent with cart checkout
  // This ensures variant_selections is always an array of {name, value} objects
  let formattedVariants = [];
  
  if (Array.isArray(variants)) {
    // If it's already an array of objects with name/value properties, use it directly
    formattedVariants = variants;
  } else if (typeof variants === 'object' && variants !== null) {
    // First try to get the product to look up variant names
    try {
      // Fetch product to get variant information
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('variants')
        .eq('id', productId)
        .single();
      
      if (!productError && product && product.variants) {
        // Convert object format to array format with proper variant names
        formattedVariants = Object.entries(variants).map(([variantId, value]) => {
          // Try to find the variant name in the product's variants
          const variant = product.variants.find(v => v.id === variantId);
          return {
            name: variant?.name || variantId, // Use actual variant name if found, fall back to ID
            value
          };
        });
      } else {
        // Fall back to the original approach if we can't fetch product info
        formattedVariants = Object.entries(variants).map(([name, value]) => ({
          name,
          value
        }));
      }
    } catch (err) {
      console.error('Error looking up variant names:', err);
      // Fall back to the original approach if there's an error
      formattedVariants = Object.entries(variants).map(([name, value]) => ({
        name,
        value
      }));
    }
  }
  
  console.log('Formatted variants:', formattedVariants);

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
    } else if (paymentMethod === 'free_order') {
      // For generic free orders, keep track of original source if available
      if (transactionId && transactionId.includes('_stripe_')) {
        paymentSource = 'stripe';
      } else if (transactionId && transactionId.includes('_token_')) {
        paymentSource = 'token';
      } else if (transactionId && transactionId.includes('_solana_')) {
        paymentSource = 'solana';
      } else {
        paymentSource = 'order'; // Default for free_order with no clear source
      }
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
        .eq('payment_metadata->>transactionId', transactionId);
      
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
    
    // Generate an order number and batch order ID (even for single orders)
    const orderNumber = await generateOrderNumber();
    const batchOrderId = paymentMetadata.isBatchOrder ? batchOrderuuidv4() : null;
    
    // Add additional metadata for consistent batch order handling
    const finalPaymentMetadata = {
      ...paymentMetadata,
      orderId: transactionId, // For backward compatibility
      batchOrderId, // Link to batch ID even for single orders
      isBatchOrder: paymentMetadata.isBatchOrder || false,
      isSingleItemOrder: paymentMetadata.isSingleItemOrder || true
    };
    
    // Call create_order function with service role permissions
    const { data: orderId, error } = await supabase.rpc('create_order', {
      p_product_id: productId,
      p_variants: formattedVariants,
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

    // Update the order with the generated order number and batch ID
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        order_number: orderNumber,
        batchOrderId,
        item_index: 1, // For single orders, always index 1
        total_items_in_batch: 1 // For single orders, always 1 item
      })
      .eq('id', orderId);
      
    if (updateError) {
      console.warn('Error updating order number:', updateError);
      // Continue anyway - don't fail the entire request
    }

    console.log('Order created successfully:', {
      orderId,
      orderNumber,
      batchOrderId,
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
      .select('order_number, status')
      .eq('id', orderId)
      .single();
      
    if (fetchError) {
      console.warn('Could not fetch order number:', fetchError);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        orderId,
        orderNumber: orderDetails?.order_number || orderNumber,
        batchOrderId,
        isFreeOrder,
        transactionId,
        transactionSignature: isFreeOrder ? transactionSignature : undefined,
        paymentIntentId: isFreeOrder ? transactionSignature : undefined,
        // Match batch order format
        orders: [
          {
            orderId,
            orderNumber: orderDetails?.order_number || orderNumber,
            status: orderDetails?.status || 'pending',
            itemIndex: 1,
            totalItems: 1
          }
        ]
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