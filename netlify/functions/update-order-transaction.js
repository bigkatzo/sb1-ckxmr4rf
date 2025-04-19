/**
 * UPDATE ORDER TRANSACTION
 * 
 * Server-side function for updating order transaction information
 * Uses service role credentials to access database functions
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
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check if Supabase client is available
  if (!supabase) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Database connection unavailable' })
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

  // Extract transaction details from request
  const { 
    orderId, 
    transactionSignature, 
    amountSol
  } = requestBody;

  // Validate required fields
  if (!orderId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing order ID' })
    };
  }

  if (!transactionSignature) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing transaction signature' })
    };
  }

  if (amountSol === undefined || amountSol === null) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing amount in SOL' })
    };
  }

  try {
    console.log('Updating order transaction with service role permissions');
    
    // Call update_order_transaction function with service role permissions
    const { data, error } = await supabase.rpc('update_order_transaction', {
      p_order_id: orderId,
      p_transaction_signature: transactionSignature,
      p_amount_sol: amountSol
    });

    if (error) {
      console.error('Error updating order transaction:', error);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error.message })
      };
    }

    console.log('Order transaction updated successfully');
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data })
    };
  } catch (err) {
    console.error('Error in update-order-transaction function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 