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
  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  // Extract order details from request
  const { 
    productId, 
    variants, 
    shippingInfo, 
    walletAddress,
    paymentMetadata = {}
  } = requestBody;

  // Validate required fields
  if (!productId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing product ID' })
    };
  }

  if (!shippingInfo) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing shipping information' })
    };
  }

  if (!walletAddress) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing wallet address' })
    };
  }

  try {
    console.log('Creating order with service role permissions');
    
    // Call create_order function with service role permissions
    const { data: orderId, error } = await supabase.rpc('create_order', {
      p_product_id: productId,
      p_variants: variants || {},
      p_shipping_info: shippingInfo,
      p_wallet_address: walletAddress,
      p_payment_metadata: paymentMetadata
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