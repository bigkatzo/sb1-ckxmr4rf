/**
 * GET ORDER
 * 
 * A simple server-side function to get order details with service role permissions
 * Bypasses RLS to ensure the frontend can always access order data when needed
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with service role key
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Use GET or POST.' })
    };
  }

  try {
    let orderId, batchOrderId, transactionSignature;
    
    // Parse parameters from query string or body
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      orderId = params.orderId;
      batchOrderId = params.batchOrderId;
      transactionSignature = params.signature || params.transactionSignature;
    } else {
      // POST method - parse body
      try {
        const body = JSON.parse(event.body || '{}');
        orderId = body.orderId;
        batchOrderId = body.batchOrderId;
        transactionSignature = body.signature || body.transactionSignature;
      } catch (error) {
        log('error', 'Error parsing request body', error);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid JSON in request body' })
        };
      }
    }

    log('debug', 'Request parameters', { orderId, batchOrderId, transactionSignature });

    // Validate that at least one parameter is provided
    if (!orderId && !batchOrderId && !transactionSignature) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing required parameter. Provide orderId, batchOrderId, or transactionSignature.'
        })
      };
    }

    // Fetch order by ID
    if (orderId) {
      log('info', `Fetching order by ID: ${orderId}`);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) {
        log('error', `Error fetching order ${orderId}:`, error);
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Order not found or error fetching order' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, order: data })
      };
    }

    // Fetch orders by batch ID
    if (batchOrderId) {
      log('info', `Fetching orders in batch: ${batchOrderId}`);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('batch_order_id', batchOrderId)
        .order('item_index', { ascending: true });

      if (error) {
        log('error', `Error fetching batch orders ${batchOrderId}:`, error);
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Batch order not found or error fetching orders' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          orders: data,
          batchOrderId,
          orderCount: data.length 
        })
      };
    }

    // Fetch order by transaction signature
    if (transactionSignature) {
      log('info', `Fetching order by transaction signature: ${transactionSignature}`);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('transaction_signature', transactionSignature);

      if (error) {
        log('error', `Error fetching order with signature ${transactionSignature}:`, error);
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Order not found or error fetching order by signature' })
        };
      }

      if (!data || data.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'No orders found with this transaction signature' })
        };
      }

      // Check if this is a batch order
      let isBatchOrder = false;
      let batchId = null;
      
      if (data.length > 1 || (data[0] && data[0].batch_order_id)) {
        isBatchOrder = true;
        batchId = data[0].batch_order_id;
        
        // If it's a batch order, fetch all orders in the batch
        if (batchId) {
          log('info', `Found batch order ${batchId}, fetching all related orders`);
          const { data: batchData, error: batchError } = await supabase
            .from('orders')
            .select('*')
            .eq('batch_order_id', batchId)
            .order('item_index', { ascending: true });
            
          if (!batchError && batchData) {
            data = batchData; // Replace with complete batch data
          }
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          orders: data,
          isBatchOrder,
          batchOrderId: batchId,
          orderCount: data.length 
        })
      };
    }
  } catch (error) {
    log('error', 'Unexpected error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}; 