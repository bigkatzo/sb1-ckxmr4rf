/**
 * GET BATCH ORDERS
 * 
 * Server-side function for retrieving all orders in a batch
 * Used by the batch order processing flow to check order statuses
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
    console.log('Supabase client initialized with service role');
  }
} catch (error) {
  console.error('Error initializing Supabase client:', error);
}

// Enhanced logging function
function log(level, message, data = null) {
  const prefix = '[GET-BATCH-ORDERS]';
  const timestamp = new Date().toISOString();
  
  const logMessage = `${timestamp} ${prefix} ${message}`;
  
  switch (level) {
    case 'error':
      console.error(logMessage, data !== null ? data : '');
      break;
    case 'warn':
      console.warn(logMessage, data !== null ? data : '');
      break;
    case 'info':
      console.log(logMessage, data !== null ? data : '');
      break;
    case 'debug':
      console.log(logMessage, data !== null ? data : '');
      break;
    default:
      console.log(logMessage, data !== null ? data : '');
  }
}

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  
  // Handle OPTIONS request (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }
  
  // Check if Supabase client is available
  if (!supabase) {
    log('error', 'Supabase client not initialized');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Database connection not available' 
      })
    };
  }
  
  try {
    // Get batchOrderId from either query parameters or request body
    let batchOrderId;
    
    if (event.httpMethod === 'GET') {
      // Get from query parameters
      const params = event.queryStringParameters || {};
      batchOrderId = params.batchOrderId;
    } else if (event.httpMethod === 'POST') {
      // Get from request body
      try {
        const body = JSON.parse(event.body || '{}');
        batchOrderId = body.batchOrderId;
      } catch (parseError) {
        log('error', 'Error parsing request body:', parseError);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Invalid request body' 
          })
        };
      }
    } else {
      // Unsupported method
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Method not allowed' 
        })
      };
    }
    
    // Validate required parameters
    if (!batchOrderId) {
      log('error', 'Missing required parameter: batchOrderId');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing required parameter: batchOrderId' 
        })
      };
    }
    
    log('info', `Getting batch orders for batchOrderId: ${batchOrderId}`);
    
    // Query orders by batch_order_id
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, status, order_number, transaction_signature, amount_sol, created_at, updated_at, batch_order_id, item_index, total_items_in_batch')
      .or(`batch_order_id.eq.${batchOrderId},payment_metadata->batchOrderId.eq.${batchOrderId}`)
      .order('item_index', { ascending: true });
      
    if (error) {
      log('error', 'Error fetching batch orders:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Error fetching batch orders' 
        })
      };
    }
    
    if (!orders || orders.length === 0) {
      log('warn', `No orders found for batchOrderId: ${batchOrderId}`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: 'No orders found for batch ID',
          orders: []
        })
      };
    }
    
    log('info', `Found ${orders.length} orders in batch ${batchOrderId}`);
    
    // Return the orders data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        batchOrderId,
        orderCount: orders.length,
        orders
      })
    };
    
  } catch (error) {
    log('error', 'Unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Internal server error', 
        message: error.message 
      })
    };
  }
}; 