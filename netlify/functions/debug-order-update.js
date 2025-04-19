/**
 * DEBUG ORDER UPDATE
 * 
 * This function attempts to update an order status directly using multiple approaches
 */

const { createClient } = require('@supabase/supabase-js');

// Environment variables with multiple fallbacks
const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

// Initialize Supabase client
const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY);

exports.handler = async (event, context) => {
  console.log('Function invoked:', { 
    httpMethod: event.httpMethod,
    path: event.path
  });
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (err) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid JSON body' })
      };
    }

    const { orderId, transactionSignature } = requestBody;
    
    if (!orderId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing orderId parameter' })
      };
    }

    // Log the current order status
    console.log(`Checking status for order ${orderId}`);
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, status, transaction_signature')
      .eq('id', orderId)
      .single();
      
    if (orderError) {
      console.error('Error fetching order:', orderError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: `Order not found: ${orderError.message}` })
      };
    }
    
    console.log(`Current order status: ${JSON.stringify(orderData)}`);
    
    // Try all update methods in sequence and report results
    const results = {};
    
    // Method 1: Direct table update
    try {
      console.log('Method 1: Direct table update');
      const { data: updateData, error: updateError } = await supabase
        .from('orders')
        .update({ status: 'confirmed' })
        .eq('id', orderId)
        .eq('status', 'pending_payment');
        
      results.method1 = {
        success: !updateError,
        error: updateError ? updateError.message : null,
        data: updateData
      };
      
      if (updateError) {
        console.error('Method 1 failed:', updateError);
      } else {
        console.log('Method 1 success!');
      }
    } catch (error) {
      console.error('Method 1 exception:', error);
      results.method1 = {
        success: false,
        error: error.message
      };
    }
    
    // Method 2: RPC function
    if (transactionSignature) {
      try {
        console.log(`Method 2: RPC via confirm_order_payment with signature: ${transactionSignature}`);
        const { data: rpcData, error: rpcError } = await supabase.rpc('confirm_order_payment', {
          p_transaction_signature: transactionSignature,
          p_status: 'confirmed'
        });
          
        results.method2 = {
          success: !rpcError,
          error: rpcError ? rpcError.message : null,
          data: rpcData
        };
        
        if (rpcError) {
          console.error('Method 2 failed:', rpcError);
        } else {
          console.log('Method 2 success!', rpcData);
        }
      } catch (error) {
        console.error('Method 2 exception:', error);
        results.method2 = {
          success: false,
          error: error.message
        };
      }
    }
    
    // Method 3: New RPC function
    try {
      console.log('Method 3: RPC via direct_update_order_status');
      const { data: directRpcData, error: directRpcError } = await supabase.rpc('direct_update_order_status', {
        p_order_id: orderId,
        p_status: 'confirmed'
      });
        
      results.method3 = {
        success: !directRpcError,
        error: directRpcError ? directRpcError.message : null,
        data: directRpcData
      };
      
      if (directRpcError) {
        console.error('Method 3 failed:', directRpcError);
      } else {
        console.log('Method 3 success!', directRpcData);
      }
    } catch (error) {
      console.error('Method 3 exception:', error);
      results.method3 = {
        success: false,
        error: error.message
      };
    }
    
    // Method 4: Direct SQL execution
    try {
      console.log('Method 4: Direct SQL update');
      const { data: sqlData, error: sqlError } = await supabase.rpc('execute_raw_sql', {
        p_query: `UPDATE orders SET status = 'confirmed' WHERE id = '${orderId}' AND status = 'pending_payment' RETURNING id, status;`
      });
        
      results.method4 = {
        success: !sqlError,
        error: sqlError ? sqlError.message : null,
        data: sqlData
      };
      
      if (sqlError) {
        console.error('Method 4 failed:', sqlError);
      } else {
        console.log('Method 4 success!', sqlData);
      }
    } catch (error) {
      console.error('Method 4 exception:', error);
      results.method4 = {
        success: false,
        error: error.message
      };
    }
    
    // Check final order status
    const { data: finalData, error: finalError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();
      
    if (!finalError) {
      console.log(`Final order status: ${finalData.status}`);
      results.finalStatus = finalData.status;
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        results,
        message: 'Debug complete, check function logs for details'
      })
    };
    
  } catch (err) {
    console.error('Error in debug function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        details: err.message 
      })
    };
  }
}; 