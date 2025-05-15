/**
 * FIX BATCH ORDERS
 * 
 * Emergency server-side function for repairing existing batch orders
 * This can be run manually to fix orders that are stuck in draft status, 
 * missing batch_order_id values, or have inconsistent order numbers
 */
const { createClient } = require('@supabase/supabase-js');

// Enable detailed logging
const DEBUG = true;

/**
 * Enhanced logging function with prefixes and optional debug mode
 */
function log(level, message, data = null) {
  const prefix = '[FIX-BATCH-ORDERS]';
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

// Environment variables
const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
};

// Initialize Supabase with service role credentials
let supabase;
try {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    log('error', 'Missing Supabase credentials in environment variables');
  } else {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    log('info', 'Supabase client initialized with service role permissions');
  }
} catch (err) {
  log('error', 'Failed to initialize Supabase client:', err.message);
}

exports.handler = async (event, context) => {
  // Enable CORS for frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  // Allow both GET and POST for flexibility
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    log('warn', 'Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check if Supabase client is available
  if (!supabase) {
    log('error', 'Database connection unavailable');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Database connection unavailable' })
    };
  }

  try {
    // Get parameters from query string or body
    let batchOrderId, transactionSignature, forceConfirm;
    
    if (event.httpMethod === 'GET') {
      // Get parameters from query string
      const params = event.queryStringParameters || {};
      batchOrderId = params.batchOrderId;
      transactionSignature = params.transactionSignature;
      forceConfirm = params.forceConfirm === 'true';
    } else {
      // Get parameters from POST body
      const requestBody = JSON.parse(event.body);
      batchOrderId = requestBody.batchOrderId;
      transactionSignature = requestBody.transactionSignature;
      forceConfirm = requestBody.forceConfirm === true;
    }
    
    log('info', 'Fixing batch orders with parameters:', {
      batchOrderId: batchOrderId || 'not provided',
      transactionSignature: transactionSignature 
        ? `${transactionSignature.substring(0, 8)}...` 
        : 'not provided',
      forceConfirm
    });
    
    // Track results of operations
    const results = {
      batchesFixed: 0,
      batchIdsFixed: [],
      ordersFlagged: 0,
      ordersFixed: 0,
      orderNumbersFixed: 0,
      ordersConfirmed: 0,
      fixedBatchDetails: []
    };
    
    // SECTION 1: Fix specific batch if batchOrderId is provided
    if (batchOrderId) {
      log('info', `Fixing specific batch: ${batchOrderId}`);
      
      // Fix 1: Find all orders with this batchOrderId in payment_metadata but not in column
      await fixBatchOrderId(batchOrderId, results);
      
      // Fix 2: Find all orders with inconsistent order numbers
      await fixOrderNumbers(batchOrderId, results);
      
      // Fix 3: Update transaction signatures if provided
      if (transactionSignature) {
        await fixTransactionSignature(batchOrderId, transactionSignature, results);
      }
      
      // Fix 4: Confirm all orders in the batch if requested
      if (forceConfirm) {
        await confirmAllOrders(batchOrderId, results);
      }
    } else {
      // SECTION 2: Find and fix all batches with issues
      
      // Fix 1: Find all orders with batchOrderId in metadata but not in column
      log('info', 'Finding all orders with missing batch_order_id...');
      const { data: missingBatchIds, error: missingError } = await supabase
        .from('orders')
        .select('payment_metadata')
        .is('batch_order_id', null)
        .not('payment_metadata', 'is', null)
        .limit(1000);
        
      if (!missingError && missingBatchIds && missingBatchIds.length > 0) {
        // Get unique batch IDs from metadata
        const batchIds = new Set();
        for (const order of missingBatchIds) {
          if (order.payment_metadata && order.payment_metadata.batchOrderId) {
            batchIds.add(order.payment_metadata.batchOrderId);
          }
        }
        
        if (batchIds.size > 0) {
          log('info', `Found ${batchIds.size} unique batch IDs to fix`);
          
          // Fix each batch ID
          for (const batchId of batchIds) {
            await fixBatchOrderId(batchId, results);
            await fixOrderNumbers(batchId, results);
            
            // Force confirm all orders in batch if requested
            if (forceConfirm) {
              await confirmAllOrders(batchId, results);
            }
            
            results.batchIdsFixed.push(batchId);
            results.batchesFixed++;
          }
        }
      }
      
      // Fix 2: Find all orders with ORD pattern order numbers
      log('info', 'Finding all orders with ORD-style order numbers...');
      const { data: ordOrders, error: ordError } = await supabase
        .from('orders')
        .select('id, order_number, payment_metadata')
        .filter('order_number', 'like', 'ORD%')
        .not('payment_metadata', 'is', null)
        .limit(1000);
        
      if (!ordError && ordOrders && ordOrders.length > 0) {
        log('info', `Found ${ordOrders.length} orders with ORD-style order numbers`);
        
        // Group by batch ID
        const batchGroups = {};
        for (const order of ordOrders) {
          if (order.payment_metadata && order.payment_metadata.batchOrderId) {
            const batchId = order.payment_metadata.batchOrderId;
            if (!batchGroups[batchId]) {
              batchGroups[batchId] = [];
            }
            batchGroups[batchId].push(order);
          }
        }
        
        // Fix order numbers for each batch
        for (const [batchId, orders] of Object.entries(batchGroups)) {
          if (!results.batchIdsFixed.includes(batchId)) {
            await fixBatchOrderId(batchId, results);
            await fixOrderNumbers(batchId, results);
            
            // Force confirm all orders in batch if requested
            if (forceConfirm) {
              await confirmAllOrders(batchId, results);
            }
            
            results.batchIdsFixed.push(batchId);
            results.batchesFixed++;
          }
        }
      }
    }
    
    log('info', 'Fix batch orders operation completed');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        results
      })
    };
  } catch (error) {
    log('error', 'Error fixing batch orders:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fix batch orders',
        details: error.message
      })
    };
  }
};

// Helper function to fix batch_order_id
async function fixBatchOrderId(batchOrderId, results) {
  try {
    log('info', `Fixing batch_order_id for batch: ${batchOrderId}`);
    
    // Get all orders that have this batchOrderId in metadata but not in column
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, payment_metadata')
      .filter('payment_metadata->batchOrderId', 'eq', batchOrderId)
      .is('batch_order_id', null);
      
    if (error) {
      log('error', 'Error finding orders with missing batch_order_id:', error);
      return;
    }
    
    if (orders && orders.length > 0) {
      log('info', `Found ${orders.length} orders missing batch_order_id`);
      
      // Update all these orders to set batch_order_id
      const orderIds = orders.map(order => order.id);
      const { error: updateError } = await supabase
        .from('orders')
        .update({ batch_order_id: batchOrderId })
        .in('id', orderIds);
        
      if (updateError) {
        log('error', 'Error updating batch_order_id:', updateError);
      } else {
        log('info', `Successfully updated batch_order_id for ${orderIds.length} orders`);
        results.ordersFlagged += orders.length;
        results.ordersFixed += orderIds.length;
      }
    } else {
      log('info', 'No orders found with missing batch_order_id');
    }
  } catch (error) {
    log('error', 'Error in fixBatchOrderId:', error);
  }
}

// Helper function to fix inconsistent order numbers
async function fixOrderNumbers(batchOrderId, results) {
  try {
    log('info', `Fixing order numbers for batch: ${batchOrderId}`);
    
    // Find a consistent SF-style order number to use
    let commonOrderNumber;
    
    // First try to find an existing SF-style order number
    const { data: sfOrders, error: sfError } = await supabase
      .from('orders')
      .select('order_number')
      .eq('batch_order_id', batchOrderId)
      .filter('order_number', 'like', 'SF-%')
      .limit(1);
      
    if (!sfError && sfOrders && sfOrders.length > 0) {
      commonOrderNumber = sfOrders[0].order_number;
      log('info', `Using existing SF-style order number: ${commonOrderNumber}`);
    } else {
      // If no SF-style order number found, generate a new one
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      commonOrderNumber = `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
      log('info', `Generated new SF-style order number: ${commonOrderNumber}`);
    }
    
    // Find all orders in this batch with non-SF style order numbers
    const { data: nonSfOrders, error: nonSfError } = await supabase
      .from('orders')
      .select('id, order_number')
      .eq('batch_order_id', batchOrderId)
      .not('order_number', 'like', 'SF-%');
      
    if (nonSfError) {
      log('error', 'Error finding orders with non-SF order numbers:', nonSfError);
      return;
    }
    
    // Also find orders that have this batch ID in metadata but don't have proper order numbers
    const { data: metadataOrders, error: metadataError } = await supabase
      .from('orders')
      .select('id, order_number')
      .filter('payment_metadata->batchOrderId', 'eq', batchOrderId)
      .not('order_number', 'like', 'SF-%');
      
    // Combine both result sets, deduplicating by ID
    const allOrdersToFix = [];
    const seenIds = new Set();
    
    if (nonSfOrders) {
      for (const order of nonSfOrders) {
        if (!seenIds.has(order.id)) {
          allOrdersToFix.push(order);
          seenIds.add(order.id);
        }
      }
    }
    
    if (metadataOrders) {
      for (const order of metadataOrders) {
        if (!seenIds.has(order.id)) {
          allOrdersToFix.push(order);
          seenIds.add(order.id);
        }
      }
    }
    
    if (allOrdersToFix.length > 0) {
      log('info', `Found ${allOrdersToFix.length} orders with non-SF order numbers`);
      
      // Update all these orders to use the common order number
      const orderIds = allOrdersToFix.map(order => order.id);
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          order_number: commonOrderNumber,
          batch_order_id: batchOrderId // Ensure batch_order_id is set
        })
        .in('id', orderIds);
        
      if (updateError) {
        log('error', 'Error updating order numbers:', updateError);
      } else {
        log('info', `Successfully updated order numbers for ${orderIds.length} orders`);
        results.orderNumbersFixed += orderIds.length;
      }
    } else {
      log('info', 'No orders found with non-SF order numbers');
    }
  } catch (error) {
    log('error', 'Error in fixOrderNumbers:', error);
  }
}

// Helper function to update transaction signatures
async function fixTransactionSignature(batchOrderId, transactionSignature, results) {
  try {
    log('info', `Setting transaction signature for batch: ${batchOrderId}`);
    
    // Get all orders in this batch
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, status, transaction_signature, payment_metadata')
      .eq('batch_order_id', batchOrderId);
      
    if (error) {
      log('error', 'Error finding orders in batch:', error);
      return;
    }
    
    if (orders && orders.length > 0) {
      log('info', `Found ${orders.length} orders in batch`);
      
      // Update each order individually with its proper amount
      for (const order of orders) {
        // Extract the original price from payment_metadata
        const originalPrice = order.payment_metadata?.originalPrice || 0;
        const couponDiscount = order.payment_metadata?.couponDiscount || 0;
        const orderAmount = Math.max(0, originalPrice - couponDiscount);
        
        log('debug', `Setting amount for order ${order.id}: ${orderAmount} SOL`, {
          originalPrice,
          couponDiscount,
          finalAmount: orderAmount
        });
        
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            transaction_signature: transactionSignature,
            amount_sol: orderAmount,
            status: 'pending_payment', // At least move to pending_payment
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);
          
        if (updateError) {
          log('error', `Error updating order ${order.id}:`, updateError);
        } else {
          log('info', `Successfully updated transaction signature and amount for order ${order.id}`);
        }
      }
      
      // Get the batch details to save for the results
      const batchDetails = {
        batchOrderId,
        transactionSignature,
        orderCount: orders.length,
        ordersUpdated: orders.length
      };
      
      results.fixedBatchDetails.push(batchDetails);
    } else {
      log('info', 'No orders found in batch');
    }
  } catch (error) {
    log('error', 'Error in fixTransactionSignature:', error);
  }
}

// Helper function to confirm all orders in a batch
async function confirmAllOrders(batchOrderId, results) {
  try {
    log('info', `Confirming all orders for batch: ${batchOrderId}`);
    
    // Get all orders in this batch that are not already confirmed
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, status')
      .eq('batch_order_id', batchOrderId)
      .not('status', 'eq', 'confirmed');
      
    if (error) {
      log('error', 'Error finding non-confirmed orders in batch:', error);
      return;
    }
    
    if (orders && orders.length > 0) {
      log('info', `Found ${orders.length} non-confirmed orders in batch`);
      
      // Update all these orders to confirmed status
      const orderIds = orders.map(order => order.id);
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .in('id', orderIds);
        
      if (updateError) {
        log('error', 'Error confirming orders:', updateError);
      } else {
        log('info', `Successfully confirmed ${orderIds.length} orders`);
        results.ordersConfirmed += orderIds.length;
      }
    } else {
      log('info', 'No non-confirmed orders found in batch');
    }
  } catch (error) {
    log('error', 'Error in confirmAllOrders:', error);
  }
} 