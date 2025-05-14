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

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
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

  // Parse request body
  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
    console.log('Received update request:', {
      ...requestBody,
      // Only show part of the signature for security
      transactionSignature: requestBody.transactionSignature 
        ? `${requestBody.transactionSignature.substring(0, 8)}...${requestBody.transactionSignature.slice(-8)}` 
        : 'none'
    });
  } catch (err) {
    console.error('Invalid request body:', event.body);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  // Extract transaction details from request
  const { 
    orderId, 
    transactionSignature, 
    amountSol,
    batchOrderId, // Add support for batch order ID
    isBatchOrder // Flag to indicate if this is a batch order
  } = requestBody;

  // Check if this is a batch order
  if (isBatchOrder === true || batchOrderId) {
    console.log('Processing batch order:', {
      batchOrderId: batchOrderId || 'unknown',
      isBatchOrder: isBatchOrder
    });
    
    const batchId = batchOrderId || (orderId ? await getBatchOrderId(orderId) : null);
    
    if (batchId) {
      return await updateBatchOrderTransaction(batchId, transactionSignature, amountSol, headers);
    } else {
      console.warn('Batch order specified but no valid batch ID found');
    }
  }

  // Add recovery logic for missing orderId
  if (!orderId) {
    console.warn('Missing orderId in request:', requestBody);
    
    // Only try recovery if we have a transaction signature
    if (!transactionSignature) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing transaction signature and order ID' })
      };
    }
    
    try {
      // Try to find the most recent order with the wallet address
      if (requestBody.walletAddress) {
        console.log('Attempting to find order for wallet:', requestBody.walletAddress);
        
        // Look for recent draft orders from this wallet
        const { data: recentOrders, error: recentError } = await supabase
          .from('orders')
          .select('id, order_number, status, batch_order_id')
          .eq('wallet_address', requestBody.walletAddress)
          .in('status', ['draft'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (!recentError && recentOrders && recentOrders.length > 0) {
          const recoveredOrderId = recentOrders[0].id;
          console.log('Recovered orderId from wallet address:', recoveredOrderId);
          
          // Check if this is part of a batch order
          if (recentOrders[0].batch_order_id) {
            console.log('Recovered order is part of batch:', recentOrders[0].batch_order_id);
            return await updateBatchOrderTransaction(
              recentOrders[0].batch_order_id,
              transactionSignature,
              amountSol,
              headers
            );
          }
          
          // Update this order
          return await updateOrderTransaction(
            recoveredOrderId, 
            transactionSignature, 
            amountSol, 
            headers
          );
        }
      }
      
      // Try to find any recent draft orders - last resort
      console.log('Attempting to find any recent draft orders');
      const { data: anyOrders, error: anyError } = await supabase
        .from('orders')
        .select('id, order_number, status, batch_order_id')
        .in('status', ['draft'])
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!anyError && anyOrders && anyOrders.length > 0) {
        const recoveredOrderId = anyOrders[0].id;
        console.log('Recovered orderId from recent orders:', recoveredOrderId);
        
        // Check if this is part of a batch order
        if (anyOrders[0].batch_order_id) {
          console.log('Recovered order is part of batch:', anyOrders[0].batch_order_id);
          return await updateBatchOrderTransaction(
            anyOrders[0].batch_order_id,
            transactionSignature,
            amountSol,
            headers
          );
        }
        
        // Update this order
        return await updateOrderTransaction(
          recoveredOrderId, 
          transactionSignature, 
          amountSol, 
          headers
        );
      }
      
      // Could not recover an order
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing order ID and recovery failed',
          recoveryAttempted: true
        })
      };
    } catch (recoveryError) {
      console.error('Error in order recovery:', recoveryError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing order ID and recovery failed with error',
          details: recoveryError.message
        })
      };
    }
  }

  // If we have an orderId, check if it's part of a batch order
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('batch_order_id')
    .eq('id', orderId)
    .single();
    
  if (!orderError && orderData && orderData.batch_order_id) {
    console.log('Order is part of batch:', orderData.batch_order_id);
    return await updateBatchOrderTransaction(
      orderData.batch_order_id,
      transactionSignature,
      amountSol,
      headers
    );
  }

  // If we have an orderId that's not part of a batch, proceed with the update
  return await updateOrderTransaction(orderId, transactionSignature, amountSol, headers);
};

// Helper function to get batch order ID from order ID
async function getBatchOrderId(orderId) {
  if (!orderId) return null;
  
  const { data, error } = await supabase
    .from('orders')
    .select('batch_order_id')
    .eq('id', orderId)
    .single();
    
  if (error || !data || !data.batch_order_id) {
    console.warn('Error getting batch order ID:', error?.message || 'No batch ID found');
    return null;
  }
  
  return data.batch_order_id;
}

// Helper function to update batch order transaction
async function updateBatchOrderTransaction(batchOrderId, transactionSignature, amountSol, headers) {
  if (!batchOrderId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing batch order ID' })
    };
  }
  
  if (!transactionSignature) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing transaction signature' })
    };
  }

  if (amountSol === undefined || amountSol === null) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing amount in SOL' })
    };
  }

  // Update transaction signature for all orders in the batch
  const amountSolFloat = parseFloat(amountSol || 0);
  
  // Check if this is a free order (transaction signature starts with 'free_')
  const isFreeOrder = transactionSignature && transactionSignature.startsWith('free_');
  
  console.log('Updating batch order transaction:', {
    batchOrderId, 
    transactionSignature: transactionSignature ? `${transactionSignature.substring(0, 8)}...` : 'none',
    amountSol: amountSolFloat,
    isFreeOrder
  });

  try {
    // Update the transaction signature for all orders in the batch
    const { error: updateError } = await supabase.rpc('update_batch_order_transaction', {
      p_batch_order_id: batchOrderId,
      p_transaction_signature: transactionSignature,
      p_amount_sol: amountSolFloat
    });

    if (updateError) {
      console.error('Error updating batch order transaction:', updateError);
      
      // If we get a unique constraint error, try to recover by using the classic update approach
      if (updateError.message.includes('duplicate key value violates unique constraint')) {
        console.log('Attempting to recover from unique constraint error by updating individual orders...');
        
        // Get all orders in this batch
        const { data: batchOrders, error: batchError } = await supabase
          .from('orders')
          .select('id')
          .eq('batch_order_id', batchOrderId)
          .eq('status', 'draft');
          
        if (batchError || !batchOrders || batchOrders.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Unique constraint violation and no draft orders found in batch',
              details: updateError.message 
            })
          };
        }
        
        // Try to update the first order (others will fail due to constraint)
        const firstOrderId = batchOrders[0].id;
        console.log('Attempting to update first order in batch:', firstOrderId);
        
        const { error: firstOrderError } = await supabase.rpc('update_order_transaction', {
          p_order_id: firstOrderId,
          p_transaction_signature: transactionSignature,
          p_amount_sol: amountSolFloat
        });
        
        if (firstOrderError) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Failed to update both batch and individual orders',
              details: firstOrderError.message 
            })
          };
        }
        
        // If first order update succeeded, update status for the rest directly (skipping signature)
        if (batchOrders.length > 1) {
          const otherOrderIds = batchOrders.slice(1).map(order => order.id);
          
          // Update other orders to pending_payment without setting transaction_signature
          const { error: batchUpdateError } = await supabase
            .from('orders')
            .update({
              status: 'pending_payment',
              amount_sol: amountSolFloat / batchOrders.length,
              updated_at: new Date().toISOString()
            })
            .in('id', otherOrderIds);
          
          if (batchUpdateError) {
            console.warn('Error updating other orders in batch:', batchUpdateError);
            // Continue anyway as the first order update succeeded
          }
        }
      } else {
        // For other errors, return error response
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: updateError.message })
        };
      }
    }
    
    // For free orders, automatically confirm the transaction for all orders in the batch
    if (isFreeOrder) {
      console.log('Auto-confirming free batch order:', batchOrderId);
      
      // Confirm all orders in the batch
      const { error: confirmError } = await supabase.rpc('confirm_batch_order_transaction', {
        p_batch_order_id: batchOrderId
      });
      
      if (confirmError) {
        console.error('Error confirming free batch order:', confirmError);
        // Don't fail the entire request, just log the error
      } else {
        console.log('Free batch order confirmed successfully');
      }
    }

    console.log('Batch order transaction updated successfully');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        data: { 
          batchOrderId, 
          transactionSignature, 
          amountSol: amountSolFloat,
          isBatchOrder: true
        } 
      })
    };
  } catch (err) {
    console.error('Error in update-batch-order-transaction function:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}

// Helper function to update order transaction for individual orders
async function updateOrderTransaction(orderId, transactionSignature, amountSol, headers) {
  if (!transactionSignature) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing transaction signature' })
    };
  }

  if (amountSol === undefined || amountSol === null) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing amount in SOL' })
    };
  }

  // Update transaction signature
  const amountSolFloat = parseFloat(amountSol || 0);
  
  // Check if this is a free order (transaction signature starts with 'free_')
  const isFreeOrder = transactionSignature && transactionSignature.startsWith('free_');
  
  console.log('Updating order transaction:', {
    orderId, 
    transactionSignature: transactionSignature ? `${transactionSignature.substring(0, 8)}...` : 'none',
    amountSol: amountSolFloat,
    isFreeOrder
  });

  try {
    // Update the transaction signature
    const { error: updateError } = await supabase.rpc('update_order_transaction', {
      p_order_id: orderId,
      p_transaction_signature: transactionSignature,
      p_amount_sol: amountSolFloat
    });

    if (updateError) {
      console.error('Error updating order transaction:', updateError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: updateError.message })
      };
    }
    
    // For free orders, automatically confirm the transaction
    if (isFreeOrder) {
      console.log('Auto-confirming free order:', orderId);
      
      // Confirm the order 
      const { error: confirmError } = await supabase.rpc('confirm_order_transaction', {
        p_order_id: orderId
      });
      
      if (confirmError) {
        console.error('Error confirming free order:', confirmError);
        // Don't fail the entire request, just log the error
      } else {
        console.log('Free order confirmed successfully');
      }
    }

    console.log('Order transaction updated successfully');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: { orderId, transactionSignature, amountSol: amountSolFloat } })
    };
  } catch (err) {
    console.error('Error in update-order-transaction function:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
} 