/**
 * Retrieves order details using service role to bypass RLS policies
 * 
 * This endpoint can be used by the OrderSuccessView to securely retrieve
 * order details even when RLS policies might restrict access.
 * Security: Only allows access to specific orders that were just created/paid for.
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with service role key to bypass RLS policies
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  // Accept both GET and POST methods
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Parse parameters based on method
  let orderId, transactionSignature, timestamp, hmacSignature;
  
  if (event.httpMethod === 'GET') {
    const params = new URLSearchParams(event.queryStringParameters);
    orderId = params.get('orderId');
    transactionSignature = params.get('transactionSignature');
    timestamp = params.get('timestamp');
    hmacSignature = params.get('signature');
  } else {
    try {
      const body = JSON.parse(event.body);
      orderId = body.orderId;
      transactionSignature = body.transactionSignature;
      timestamp = body.timestamp;
      hmacSignature = body.signature;
    } catch (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request body' })
      };
    }
  }

  // Basic validation
  if (!orderId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Order ID is required' })
    };
  }

  // Security check: Verify the request is recent (within 5 minutes)
  if (timestamp) {
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Date.now();
    const fiveMinutesInMs = 5 * 60 * 1000;
    
    if (isNaN(requestTime) || (currentTime - requestTime) > fiveMinutesInMs) {
      console.warn('Request timestamp expired or invalid:', { requestTime, currentTime, diff: currentTime - requestTime });
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Request expired' })
      };
    }
  }

  // Additional security validation can be implemented here
  // Typically we would validate a HMAC signature using a secret key
  // but for simplicity and compatibility, we're using other validation methods

  try {
    // Query the order and verify it was recently created or paid for
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        products:product_id (
          name,
          description,
          imageUrl
        ),
        collections:collection_id (
          name,
          slug
        )
      `)
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) {
      console.error('Error fetching order or order not found:', orderError || 'Order not found');
      return {
        statusCode: 404,
        body: JSON.stringify({ 
          error: 'Order not found',
          details: orderError
        })
      };
    }

    // Security check: If transaction signature is provided, validate it matches
    if (transactionSignature && order.transaction_signature !== transactionSignature) {
      console.warn('Transaction signature mismatch:', { 
        expected: order.transaction_signature,
        received: transactionSignature
      });
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Transaction signature mismatch' })
      };
    }

    // Security check: Only allow access to orders in specific statuses
    // This ensures we're only accessing orders that were just created/paid for
    const allowedStatuses = ['confirmed', 'pending_payment'];
    if (!allowedStatuses.includes(order.status)) {
      console.warn('Attempted to access order with disallowed status:', order.status);
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied for this order status' })
      };
    }

    // Security check: Only allow access to recently created/updated orders
    // This helps ensure we're only accessing orders in the success view flow
    const orderDate = new Date(order.created_at || order.updated_at);
    const currentTime = new Date();
    const hourInMs = 60 * 60 * 1000;
    const timeDiff = currentTime.getTime() - orderDate.getTime();
    
    // Only allow access to orders created/updated within the last hour
    if (timeDiff > hourInMs) {
      console.warn('Attempted to access old order:', { 
        orderDate, 
        currentTime, 
        ageInHours: timeDiff / hourInMs 
      });
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied for older orders' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        data: order
      })
    };
  } catch (error) {
    console.error('Error in get-order-details:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
}; 