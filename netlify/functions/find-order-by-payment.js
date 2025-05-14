/**
 * FIND ORDER BY PAYMENT
 * 
 * This function looks up an order by its payment intent ID,
 * helping recover from situations where the client loses track of the order ID.
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase with service role key to bypass RLS policies
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  // Enable CORS for frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body);
    const { paymentIntentId } = body;

    if (!paymentIntentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing payment intent ID' })
      };
    }

    console.log(`Looking for order with payment intent ID: ${paymentIntentId}`);

    // First check for exact match in transaction_signature
    const { data: exactMatch, error: exactError } = await supabase
      .from('orders')
      .select('id, order_number, status, transaction_signature')
      .eq('transaction_signature', paymentIntentId)
      .limit(1);

    if (exactError) {
      console.error('Error searching for exact match:', exactError);
    } else if (exactMatch && exactMatch.length > 0) {
      console.log('Found exact match:', exactMatch[0]);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          orderId: exactMatch[0].id,
          orderNumber: exactMatch[0].order_number,
          status: exactMatch[0].status
        })
      };
    }

    // Next check recent draft or pending_payment orders from the last hour
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { data: recentOrders, error: recentError } = await supabase
      .from('orders')
      .select('id, order_number, status, created_at')
      .in('status', ['draft', 'pending_payment'])
      .gt('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Error searching for recent orders:', recentError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Error searching for recent orders' })
      };
    }

    if (recentOrders && recentOrders.length > 0) {
      console.log(`Found ${recentOrders.length} recent orders, using the most recent one`);
      const mostRecent = recentOrders[0];
      
      // Update this order with the payment intent ID
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          transaction_signature: paymentIntentId,
          payment_metadata: { 
            paymentIntentId, 
            paymentMethod: 'stripe',
            recoveredAt: new Date().toISOString() 
          }
        })
        .eq('id', mostRecent.id);
        
      if (updateError) {
        console.error('Error updating order with payment ID:', updateError);
      } else {
        console.log(`Updated order ${mostRecent.id} with payment intent ${paymentIntentId}`);
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          orderId: mostRecent.id,
          orderNumber: mostRecent.order_number,
          status: mostRecent.status,
          note: 'Used most recent order as recovery mechanism'
        })
      };
    }

    // If we get here, we couldn't find a matching order
    console.log('No matching order found for payment intent:', paymentIntentId);
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'No matching order found for this payment' 
      })
    };
  } catch (error) {
    console.error('Error in find-order-by-payment:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 