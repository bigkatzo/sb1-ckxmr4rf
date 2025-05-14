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
      headers
    };
  }

  try {
    // Extract parameters
    let orderId, batchOrderId, transactionSignature;
    
    if (event.httpMethod === 'GET') {
      // Handle GET request with query parameters
      const params = event.queryStringParameters || {};
      orderId = params.orderId || params.id;
      batchOrderId = params.batchOrderId;
      transactionSignature = params.transactionSignature;
    } else if (event.httpMethod === 'POST') {
      // Handle POST request with JSON body
      try {
        const body = JSON.parse(event.body || '{}');
        orderId = body.orderId || body.id;
        batchOrderId = body.batchOrderId;
        transactionSignature = body.transactionSignature;
      } catch (error) {
        log('error', 'Failed to parse request body', error);
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
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Method not allowed'
        })
      };
    }

    // Log request parameters
    log('debug', 'Request parameters', { orderId, batchOrderId, transactionSignature });

    // Validation: Need at least one identifier to fetch order(s)
    if (!orderId && !batchOrderId && !transactionSignature) {
      log('error', 'Missing required parameters');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Missing required parameters. Please provide orderId, batchOrderId, or transactionSignature.'
        })
      };
    }

    // CASE 1: Fetch a single order by ID
    if (orderId) {
      log('info', `Fetching order by ID: ${orderId}`);
      
      try {
        // Use the RPC function to bypass RLS
        const { data, error } = await supabase.rpc('get_order_by_id', {
          p_order_id: orderId
        });
        
        if (error) {
          log('error', 'Error fetching order by ID', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              success: false,
              error: error.message
            })
          };
        }
        
        if (!data || !data.length) {
          log('warn', `Order not found with ID: ${orderId}`);
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'Order not found'
            })
          };
        }
        
        log('info', 'Successfully retrieved order', { id: data[0].id });
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            order: data[0]
          })
        };
      } catch (error) {
        log('error', 'Error in get_order_by_id RPC', error);
        
        // Fallback to direct query if RPC fails
        try {
          log('info', 'Falling back to direct query');
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();
          
          if (error) {
            log('error', 'Error in fallback query', error);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({
                success: false,
                error: error.message
              })
            };
          }
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              order: data
            })
          };
        } catch (fallbackError) {
          log('error', 'Fallback query failed', fallbackError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              success: false,
              error: fallbackError.message || 'Failed to retrieve order'
            })
          };
        }
      }
    }

    // CASE 2: Fetch orders by batch ID
    if (batchOrderId) {
      log('info', `Fetching orders by batch ID: ${batchOrderId}`);
      
      try {
        // Use the RPC function to bypass RLS
        const { data, error } = await supabase.rpc('get_orders_by_batch_id', {
          p_batch_order_id: batchOrderId
        });
        
        if (error) {
          log('error', 'Error fetching orders by batch ID', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              success: false,
              error: error.message
            })
          };
        }
        
        if (!data || !data.length) {
          log('warn', `No orders found for batch ID: ${batchOrderId}`);
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'No orders found for this batch ID'
            })
          };
        }
        
        log('info', 'Successfully retrieved batch orders', { 
          batchId: batchOrderId, 
          count: data.length 
        });
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            orders: data,
            orderCount: data.length,
            batchOrderId
          })
        };
      } catch (error) {
        log('error', 'Error in get_orders_by_batch_id RPC', error);
        
        // Fallback to direct query if RPC fails
        try {
          log('info', 'Falling back to direct query for batch orders');
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('batch_order_id', batchOrderId)
            .order('item_index', { ascending: true });
          
          if (error) {
            log('error', 'Error in fallback batch query', error);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({
                success: false,
                error: error.message
              })
            };
          }
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              orders: data,
              orderCount: data.length,
              batchOrderId
            })
          };
        } catch (fallbackError) {
          log('error', 'Fallback batch query failed', fallbackError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              success: false,
              error: fallbackError.message || 'Failed to retrieve batch orders'
            })
          };
        }
      }
    }

    // CASE 3: Fetch orders by transaction signature
    if (transactionSignature) {
      log('info', `Fetching orders by transaction signature: ${transactionSignature}`);
      
      try {
        // Use the RPC function to bypass RLS
        const { data, error } = await supabase.rpc('get_orders_by_transaction', {
          p_transaction_signature: transactionSignature
        });
        
        if (error) {
          log('error', 'Error fetching orders by transaction signature', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              success: false,
              error: error.message
            })
          };
        }
        
        if (!data || !data.length) {
          log('warn', `No orders found for transaction signature: ${transactionSignature}`);
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({
              success: false,
              error: 'No orders found for this transaction signature'
            })
          };
        }
        
        log('info', 'Successfully retrieved orders by transaction', { 
          transaction: transactionSignature, 
          count: data.length 
        });
        
        // Check if this is a batch order
        const isBatchOrder = data.length > 1 || data[0].batch_order_id;
        
        if (isBatchOrder) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              orders: data,
              orderCount: data.length,
              batchOrderId: data[0].batch_order_id
            })
          };
        } else {
          // Single order
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              success: true,
              order: data[0]
            })
          };
        }
      } catch (error) {
        log('error', 'Error in get_orders_by_transaction RPC', error);
        
        // Fallback to direct query if RPC fails
        try {
          log('info', 'Falling back to direct query for transaction orders');
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('transaction_signature', transactionSignature)
            .order('item_index', { ascending: true });
          
          if (error) {
            log('error', 'Error in fallback transaction query', error);
            return {
              statusCode: 500,
              headers,
              body: JSON.stringify({
                success: false,
                error: error.message
              })
            };
          }
          
          // Check if this is a batch order
          const isBatchOrder = data.length > 1 || (data.length > 0 && data[0].batch_order_id);
          
          if (isBatchOrder) {
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                orders: data,
                orderCount: data.length,
                batchOrderId: data[0].batch_order_id
              })
            };
          } else if (data.length === 1) {
            // Single order
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                success: true,
                order: data[0]
              })
            };
          } else {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({
                success: false,
                error: 'No orders found for this transaction signature'
              })
            };
          }
        } catch (fallbackError) {
          log('error', 'Fallback transaction query failed', fallbackError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              success: false,
              error: fallbackError.message || 'Failed to retrieve orders by transaction'
            })
          };
        }
      }
    }

    // This should never happen, but just to be safe
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Invalid request parameters'
      })
    };
  } catch (error) {
    log('error', 'Unhandled error', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
}; 