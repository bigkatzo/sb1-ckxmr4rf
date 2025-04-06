/**
 * HANDLE PENDING PAYMENT
 * 
 * This function allows manual intervention for orders stuck in pending_payment status.
 * It requires admin authentication and supports specific actions on individual orders.
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for admin access
);

exports.handler = async (event, context) => {
  // Only allow POST requests with proper authorization
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Validate authorization
  const authHeader = event.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Missing authentication' })
    };
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== process.env.ADMIN_API_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid API key' })
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

  // Validate request parameters
  const { orderId, action } = requestBody;
  if (!orderId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing orderId parameter' })
    };
  }

  if (!action || !['check', 'confirm', 'cancel'].includes(action)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: 'Invalid action parameter',
        validActions: ['check', 'confirm', 'cancel']
      })
    };
  }

  try {
    // Log the action being taken
    console.log(`Manual intervention on order ${orderId}, action: ${action}`);
    
    // Perform the requested action using the database function
    const { data, error } = await supabase.rpc('recover_stale_stripe_payment', {
      p_order_id: orderId,
      p_action: action
    });

    if (error) {
      console.error('Error processing payment action:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Failed to process payment action',
          details: error.message
        })
      };
    }

    // If the action was successful, return the result
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        result: data,
        message: `Successfully performed ${action} on order ${orderId}`
      })
    };
  } catch (err) {
    console.error('Exception in handle payment function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: err.message 
      })
    };
  }
}; 