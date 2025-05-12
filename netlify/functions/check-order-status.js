/**
 * Utility endpoint to check and fix order status
 * This is a diagnostic tool to help resolve payment issues
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  // Basic security - require a key parameter
  const params = new URLSearchParams(event.queryStringParameters);
  const key = params.get('key');
  
  if (key !== 'sb1-debug') {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }
  
  const orderId = params.get('orderId');
  const paymentIntentId = params.get('paymentIntentId');
  const action = params.get('action') || 'check';
  
  if (!orderId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing orderId parameter' })
    };
  }

  try {
    // Get full order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
      
    if (orderError) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Order not found', details: orderError })
      };
    }
    
    // Check for action
    if (action === 'fix' && order.status === 'pending_payment') {
      // Force update to confirmed
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
        
      if (updateError) {
        return {
          statusCode: 500,
          body: JSON.stringify({ 
            error: 'Failed to update order status', 
            details: updateError,
            order: order 
          })
        };
      }
      
      // Get updated order
      const { data: updatedOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
        
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Order updated successfully',
          before: order,
          after: updatedOrder
        })
      };
    }
    
    // If payment intent ID is provided, try to associate it with the order
    if (paymentIntentId && order.transaction_signature !== paymentIntentId) {
      // Try to update the order's transaction signature
      const { error: updateSigError } = await supabase
        .from('orders')
        .update({ 
          transaction_signature: paymentIntentId,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
        
      if (updateSigError) {
        return {
          statusCode: 500,
          body: JSON.stringify({ 
            error: 'Failed to update transaction signature', 
            details: updateSigError,
            order: order 
          })
        };
      }
      
      // Get updated order
      const { data: sigUpdatedOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();
        
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Transaction signature updated',
          before: order,
          after: sigUpdatedOrder
        })
      };
    }
    
    // If we're just checking, return the order details
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        order: order,
        fixUrl: `/.netlify/functions/check-order-status?key=sb1-debug&orderId=${orderId}&action=fix`,
        linkPaymentUrl: paymentIntentId ? 
          `/.netlify/functions/check-order-status?key=sb1-debug&orderId=${orderId}&paymentIntentId=${paymentIntentId}` : 
          'No payment intent ID provided'
      })
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}; 