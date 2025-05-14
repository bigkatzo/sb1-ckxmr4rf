/**
 * Simple endpoint to get order details by ID
 * Used primarily during checkout to confirm order details
 */

const { createClient } = require('@supabase/supabase-js');

// Enable detailed logging
const DEBUG = true;

/**
 * Enhanced logging function with prefixes and timestamps
 */
function log(level, message, data = null) {
  const prefix = '[GET-ORDER]';
  const timestamp = new Date().toISOString();
  
  const logMessage = `${timestamp} ${prefix} ${message}`;
  
  switch (level) {
    case 'debug':
      if (DEBUG) console.log(logMessage, data !== null ? data : '');
      break;
    case 'info':
      console.log(logMessage, data !== null ? data : '');
      break;
    case 'warn':
      console.warn(logMessage, data !== null ? data : '');
      break;
    case 'error':
      console.error(logMessage, data !== null ? data : '');
      break;
    default:
      console.log(logMessage, data !== null ? data : '');
  }
}

// Initialize Supabase with service role key to bypass RLS policies
let supabase;
try {
  supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  );
  log('info', 'Supabase client initialized');
} catch (initError) {
  log('error', 'Failed to initialize Supabase client:', initError);
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    log('warn', 'Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Get order ID from query parameters
  const orderId = event.queryStringParameters?.id;
  
  if (!orderId) {
    log('warn', 'Missing order ID parameter');
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Order ID is required' })
    };
  }

  // Check if Supabase is initialized
  if (!supabase) {
    log('error', 'Supabase client not initialized');
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'Database connection unavailable' })
    };
  }

  try {
    log('info', 'Fetching order details for:', orderId);
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, status, batch_order_id, product_id, transaction_signature')
      .eq('id', orderId)
      .single();
    
    if (error) {
      log('error', 'Error fetching order:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
    
    if (!order) {
      log('warn', 'Order not found:', orderId);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Order not found' })
      };
    }

    log('info', 'Order found:', { id: order.id, status: order.status, orderNumber: order.order_number });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(order)
    };
  } catch (error) {
    log('error', 'Unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}; 