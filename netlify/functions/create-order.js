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

  if (!productId || !shippingInfo) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required parameters' })
    };
  }

  // Create Supabase client with service role key for direct database access
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Check for free order with 100% discount
  const isFreeOrder = paymentMetadata && 
    paymentMetadata.couponDiscount && 
    paymentMetadata.originalPrice && 
    paymentMetadata.couponDiscount >= paymentMetadata.originalPrice;

  // Generate a unique ID for this transaction to prevent duplicates
  const transactionId = paymentMetadata.transactionId || 
    `free_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  // Include transactionId in the metadata
  const finalPaymentMetadata = {
    ...paymentMetadata,
    transactionId
  };

  try {
    // If this is a free order, check if an order with this transaction ID already exists
    if (isFreeOrder) {
      console.log('Processing free order, checking for duplicates...');
      
      // First check if there's already an order with this transaction ID
      const { data: existingOrders, error: searchError } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_metadata->transactionId', transactionId);
      
      if (searchError) {
        console.error('Error searching for duplicate orders:', searchError);
        // Continue with order creation even if search fails
      } else if (existingOrders && existingOrders.length > 0) {
        console.log('Duplicate order detected, returning existing order ID:', existingOrders[0].id);
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            orderId: existingOrders[0].id,
            isDuplicate: true 
          })
        };
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

    console.log('Order created successfully:', orderId);
    return {
      statusCode: 200,
      body: JSON.stringify({ orderId })
    };
  } catch (err) {
    console.error('Error in create-order function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 