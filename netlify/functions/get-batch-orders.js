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
    console.log('Supabase client initialized with service role permissions');
  }
} catch (err) {
  console.error('Failed to initialize Supabase client:', err.message);
}

exports.handler = async (event, context) => {
  // Enable CORS for frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Parse query parameters
  const { batchOrderId } = event.queryStringParameters || {};

  if (!batchOrderId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing batchOrderId parameter' })
    };
  }

  // Check if Supabase client is available
  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Database connection unavailable' })
    };
  }

  try {
    console.log(`Fetching orders for batch: ${batchOrderId}`);

    // First attempt: Using batch_order_id column
    let { data: orders, error } = await supabase
      .from('orders')
      .select('id, status, transaction_signature, order_number, amount_sol, product:product_id(name), created_at, updated_at')
      .eq('batch_order_id', batchOrderId)
      .order('created_at', { ascending: true });

    // If no orders found or error, try with metadata query
    if (error || !orders || orders.length === 0) {
      console.log('No orders found with batch_order_id column, trying with payment_metadata');
      
      // Second attempt: Using payment_metadata if first attempt yielded nothing
      const { data: metadataOrders, error: metadataError } = await supabase
        .from('orders')
        .select('id, status, transaction_signature, order_number, amount_sol, product:product_id(name), created_at, updated_at')
        .filter('payment_metadata->batchOrderId', 'eq', batchOrderId)
        .order('created_at', { ascending: true });
        
      if (metadataError) {
        console.error('Error querying with payment_metadata:', metadataError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Database error',
            details: metadataError.message
          })
        };
      }
      
      if (metadataOrders && metadataOrders.length > 0) {
        console.log(`Found ${metadataOrders.length} orders using payment_metadata.batchOrderId`);
        orders = metadataOrders;
      } else {
        console.warn(`No orders found for batch ID: ${batchOrderId}`);
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ 
            success: false,
            error: 'No orders found for this batch ID' 
          })
        };
      }
    }

    console.log(`Found ${orders.length} orders in batch ${batchOrderId}`);
    
    // Get transaction signature from any order that has it
    const orderWithSignature = orders.find(o => o.transaction_signature);
    const transactionSignature = orderWithSignature?.transaction_signature;
    
    // Count order statuses
    const draftCount = orders.filter(o => o.status === 'draft').length;
    const pendingCount = orders.filter(o => o.status === 'pending_payment').length;
    const confirmedCount = orders.filter(o => o.status === 'confirmed').length;
    
    console.log(`Order statuses: ${draftCount} draft, ${pendingCount} pending, ${confirmedCount} confirmed`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        batchOrderId,
        transactionSignature,
        orders,
        summary: {
          total: orders.length,
          draft: draftCount,
          pending: pendingCount,
          confirmed: confirmedCount
        }
      })
    };
  } catch (error) {
    console.error('Error fetching batch orders:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch batch orders',
        details: error.message
      })
    };
  }
}; 