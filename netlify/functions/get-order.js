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
    
    // First, try to use the RPC function for bypassing RLS
    const { data: rpcResult, error: rpcError } = await supabase.rpc('admin_get_order_by_id', {
      p_order_id: orderId
    });
    
    if (!rpcError && rpcResult) {
      log('info', 'Order found via RPC:', { 
        id: rpcResult.id, 
        status: rpcResult.status,
        orderNumber: rpcResult.order_number
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(rpcResult)
      };
    }
    
    // If RPC fails, log the error and fall back to direct query
    if (rpcError) {
      log('warn', 'RPC query error, falling back to direct query:', rpcError);
    }
    
    // Try a direct query next
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, status, batch_order_id, product_id, transaction_signature')
      .eq('id', orderId)
      .single();
    
    if (error) {
      log('error', 'Error fetching order:', error);
      
      // Handle RLS policy errors differently
      if (error.code === '42P17' && error.message.includes('infinite recursion detected in policy')) {
        log('error', 'RLS policy recursion error. Attempting lookup by transaction signature.');
        
        // The ID might actually be a transaction signature - try that as a fallback
        try {
          log('debug', 'Querying orders by transaction signature');
          const { data: transactionOrders, error: transactionError } = await supabase.rpc('admin_get_orders_by_transaction', {
            p_transaction_signature: orderId
          });
          
          if (!transactionError && transactionOrders && transactionOrders.length > 0) {
            log('info', 'Found order by transaction signature:', {
              id: transactionOrders[0].id,
              status: transactionOrders[0].status
            });
            
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify(transactionOrders[0])
            };
          }
          
          if (transactionError) {
            log('warn', 'Error querying by transaction signature:', transactionError);
          }
        } catch (transactionLookupError) {
          log('error', 'Error during transaction lookup:', transactionLookupError);
        }
        
        // If we still haven't found the order, try a direct query with a service role
        // as a final fallback
        try {
          log('debug', 'Attempting direct table query as final fallback');
          const { data: directOrder, error: directError } = await supabase
            .from('orders')
            .select('id, order_number, status, batch_order_id, product_id, transaction_signature')
            .eq('id', orderId)
            .single();
          
          if (!directError && directOrder) {
            log('info', 'Found order via direct query fallback:', {
              id: directOrder.id,
              status: directOrder.status
            });
            
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify(directOrder)
            };
          }
          
          if (directError) {
            log('error', 'Direct query fallback error:', directError);
            
            // All attempts failed - return an error with debugging details
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({
                error: 'All lookup methods failed',
                rpcError: rpcError?.message,
                directError: directError?.message,
                code: directError?.code,
                details: "The order could not be retrieved due to database permission issues."
              })
            };
          }
        } catch (directQueryError) {
          log('error', 'Error during direct query fallback:', directQueryError);
        }
      }
      
      // Return standard error response if all special handling failed
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message, code: error.code, details: error.details })
      };
    }
    
    if (!order) {
      log('warn', 'Order not found:', orderId);
      
      // Try to search by transaction ID as a fallback
      try {
        log('info', 'Attempting to find order by transaction signature instead');
        const { data: ordersByTx, error: txError } = await supabase.rpc('admin_get_orders_by_transaction', {
          p_transaction_signature: orderId
        });
        
        if (txError) {
          log('error', 'Error searching by transaction signature:', txError);
        } else if (ordersByTx && ordersByTx.length > 0) {
          log('info', 'Found order by transaction signature instead:', { 
            id: ordersByTx[0].id, 
            status: ordersByTx[0].status 
          });
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(ordersByTx[0])
          };
        }
      } catch (fallbackError) {
        log('error', 'Error during fallback search:', fallbackError);
      }
      
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