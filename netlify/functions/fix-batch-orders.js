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

// Helper function to get all orders in a batch
async function getBatchOrders(batchOrderId) {
  try {
    log('info', `Getting orders for batch: ${batchOrderId}`);
    
    // First try the batch_order_id column
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, status, order_number, transaction_signature, payment_metadata, batch_order_id, item_index, total_items_in_batch')
      .eq('batch_order_id', batchOrderId);
      
    if (error) {
      log('error', 'Error fetching orders by batch_order_id:', error);
      throw error;
    }
    
    // Also check orders that might have the batch ID only in metadata
    const { data: metadataOrders, error: metadataError } = await supabase
      .from('orders')
      .select('id, status, order_number, transaction_signature, payment_metadata, batch_order_id, item_index, total_items_in_batch')
      .filter('payment_metadata->batchOrderId', 'eq', batchOrderId)
      .is('batch_order_id', null); // Only get ones without batch_order_id set
      
    if (metadataError) {
      log('error', 'Error fetching orders by metadata:', metadataError);
      // Continue with what we have from the first query
    }
    
    // Combine both result sets
    const allOrders = [...(orders || [])];
    if (metadataOrders && metadataOrders.length > 0) {
      allOrders.push(...metadataOrders);
    }
    
    log('info', `Found ${allOrders.length} total orders in batch ${batchOrderId}`);
    return allOrders;
  } catch (error) {
    log('error', 'Error getting batch orders:', error);
    throw error;
  }
}

// Helper function to fix batch order IDs
async function fixBatchOrderId(batchOrderId, orders) {
  try {
    log('info', `Fixing batch_order_id for batch: ${batchOrderId}`);
    
    // Filter orders missing batch_order_id
    const ordersMissingBatchId = orders.filter(order => !order.batch_order_id);
    
    if (ordersMissingBatchId.length === 0) {
      log('info', 'All orders already have batch_order_id set correctly');
      return { success: true, fixed: 0 };
    }
    
    // Update orders missing batch_order_id
    const orderIds = ordersMissingBatchId.map(order => order.id);
    
    log('info', `Setting batch_order_id for ${orderIds.length} orders`);
    
    const { error } = await supabase
      .from('orders')
      .update({ 
        batch_order_id: batchOrderId,
        updated_at: new Date().toISOString()
      })
      .in('id', orderIds);
      
    if (error) {
      log('error', 'Error updating batch_order_id:', error);
      throw error;
    }
    
    log('info', `Successfully fixed batch_order_id for ${orderIds.length} orders`);
    return { success: true, fixed: orderIds.length };
  } catch (error) {
    log('error', 'Error fixing batch order IDs:', error);
    throw error;
  }
}

// Helper function to fix order numbers
async function fixOrderNumbers(batchOrderId, orders) {
  try {
    log('info', `Fixing order_number for batch: ${batchOrderId}`);
    
    // Find the first SF- formatted order number
    let orderNumber = orders.find(o => o.order_number?.startsWith('SF-'))?.order_number;
    
    // If no SF- number found, generate a new one
    if (!orderNumber) {
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      orderNumber = `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
      log('info', `Generated new SF order number: ${orderNumber}`);
    }
    
    // Filter orders with incorrect order number
    const ordersWithWrongNumber = orders.filter(o => o.order_number !== orderNumber);
    
    if (ordersWithWrongNumber.length === 0) {
      log('info', 'All orders already have correct order number');
      return { success: true, fixed: 0, orderNumber };
    }
    
    // Update orders with wrong order number
    const orderIds = ordersWithWrongNumber.map(order => order.id);
    
    log('info', `Setting order_number to ${orderNumber} for ${orderIds.length} orders`);
    
    const { error } = await supabase
      .from('orders')
      .update({ 
        order_number: orderNumber,
        updated_at: new Date().toISOString()
      })
      .in('id', orderIds);
      
    if (error) {
      log('error', 'Error updating order_number:', error);
      throw error;
    }
    
    log('info', `Successfully fixed order_number for ${orderIds.length} orders`);
    return { success: true, fixed: orderIds.length, orderNumber };
  } catch (error) {
    log('error', 'Error fixing order numbers:', error);
    throw error;
  }
}

// Helper function to fix item index and total items in batch
async function fixItemIndexes(batchOrderId, orders) {
  try {
    log('info', `Fixing item_index and total_items_in_batch for batch: ${batchOrderId}`);
    
    const totalItems = orders.length;
    let fixedCount = 0;
    
    // Update each order's item_index and total_items_in_batch
    for (let i = 0; i < orders.length; i++) {
      // Skip if the values are already correct
      if (orders[i].item_index === i + 1 && orders[i].total_items_in_batch === totalItems) {
        continue;
      }
      
      const { error } = await supabase
        .from('orders')
        .update({ 
          item_index: i + 1,
          total_items_in_batch: totalItems,
          updated_at: new Date().toISOString()
        })
        .eq('id', orders[i].id);
        
      if (error) {
        log('error', `Error updating item_index for order ${orders[i].id}:`, error);
      } else {
        fixedCount++;
      }
    }
    
    log('info', `Successfully fixed item_index and total_items_in_batch for ${fixedCount} orders`);
    return { success: true, fixed: fixedCount };
  } catch (error) {
    log('error', 'Error fixing item indexes:', error);
    throw error;
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
        // Get the actual price for this order from payment_metadata
        const originalPrice = order.payment_metadata?.originalPrice || 0;
        const couponDiscount = order.payment_metadata?.couponDiscount || 0;
        const orderAmount = Math.max(0, originalPrice - couponDiscount);
        
        // For orders with variant pricing, get the specific variant price
        let variantPrice = null;
        if (order.payment_metadata?.variantKey && order.payment_metadata?.variantPrices) {
          variantPrice = order.payment_metadata.variantPrices[order.payment_metadata.variantKey];
        }
        
        // Use the most specific price available
        const finalAmount = variantPrice || orderAmount || 0;
        
        // Skip if the order already has this transaction signature
        if (order.transaction_signature === transactionSignature) {
          continue;
        }
        
        log('debug', `Setting transaction_signature and amount_sol for order ${order.id}`);
        
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            transaction_signature: transactionSignature,
            amount_sol: finalAmount,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);
          
        if (updateError) {
          log('error', `Error updating transaction signature for order ${order.id}:`, updateError);
          results.transactionSignatureFailed++;
        } else {
          results.transactionSignatureFixed++;
        }
      }
    }
  } catch (error) {
    log('error', 'Error fixing transaction signatures:', error);
  }
}

// Main handler function
exports.handler = async (event, context) => {
  // Set headers for CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  
  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }
  
  // Check if database connection is available
  if (!supabase) {
    log('error', 'Database connection unavailable');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Database connection unavailable' })
    };
  }
  
  try {
    let requestBody;
    
    // Parse request parameters
    if (event.httpMethod === 'POST') {
      try {
        requestBody = JSON.parse(event.body);
      } catch (error) {
        log('error', 'Invalid request body:', error);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid request body' })
        };
      }
    } else if (event.httpMethod === 'GET') {
      requestBody = event.queryStringParameters || {};
    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }
    
    const { batchOrderId, transactionSignature, fixAll = false } = requestBody;
    
    // Results object to track fixes
    const results = {
      batchOrderId,
      batchOrderIdFixed: 0,
      orderNumberFixed: 0,
      itemIndexFixed: 0,
      transactionSignatureFixed: 0,
      transactionSignatureFailed: 0,
      orderCount: 0,
      errors: []
    };
    
    // Fix specific batch if batchOrderId provided
    if (batchOrderId) {
      log('info', `Processing fixes for batch: ${batchOrderId}`);
      
      try {
        // Get all orders in the batch
        const orders = await getBatchOrders(batchOrderId);
        results.orderCount = orders.length;
        
        if (orders.length === 0) {
          log('warn', `No orders found for batch: ${batchOrderId}`);
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ 
              success: false, 
              error: 'No orders found for specified batch ID',
              batch: batchOrderId
            })
          };
        }
        
        // Fix batch_order_id
        const batchIdResult = await fixBatchOrderId(batchOrderId, orders);
        results.batchOrderIdFixed = batchIdResult.fixed;
        
        // Fix order_number
        const orderNumberResult = await fixOrderNumbers(batchOrderId, orders);
        results.orderNumberFixed = orderNumberResult.fixed;
        
        // Fix item_index and total_items_in_batch
        const itemIndexResult = await fixItemIndexes(batchOrderId, orders);
        results.itemIndexFixed = itemIndexResult.fixed;
        
        // Fix transaction signature if provided
        if (transactionSignature) {
          await fixTransactionSignature(batchOrderId, transactionSignature, results);
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            results
          })
        };
      } catch (error) {
        log('error', `Error processing batch ${batchOrderId}:`, error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Error processing batch',
            details: error.message,
            batch: batchOrderId
          })
        };
      }
    }
    
    // Process all batch orders if fixAll is true
    if (fixAll) {
      log('info', 'Processing fixes for ALL batch orders');
      
      // Find all unique batch order IDs
      const { data: batchData, error: batchError } = await supabase
        .from('orders')
        .select('batch_order_id')
        .not('batch_order_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100); // Limit to most recent 100 for safety
        
      if (batchError) {
        log('error', 'Error finding batch orders:', batchError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Error finding batch orders',
            details: batchError.message
          })
        };
      }
      
      // Also find batches from metadata
      const { data: metadataBatchData, error: metadataError } = await supabase
        .from('orders')
        .select('payment_metadata')
        .filter('payment_metadata->batchOrderId', 'neq', null)
        .is('batch_order_id', null)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (metadataError) {
        log('error', 'Error finding batches in metadata:', metadataError);
      }
      
      // Build unique list of batch IDs
      const batchIds = new Set();
      
      // Add batch IDs from the batch_order_id column
      if (batchData) {
        batchData.forEach(batch => {
          if (batch.batch_order_id) {
            batchIds.add(batch.batch_order_id);
          }
        });
      }
      
      // Add batch IDs from metadata
      if (metadataBatchData) {
        metadataBatchData.forEach(item => {
          if (item.payment_metadata?.batchOrderId) {
            batchIds.add(item.payment_metadata.batchOrderId);
          }
        });
      }
      
      // Convert to array
      const uniqueBatchIds = Array.from(batchIds);
      
      log('info', `Found ${uniqueBatchIds.length} unique batch IDs`);
      
      // Process each batch
      const batchResults = [];
      
      for (const batchId of uniqueBatchIds) {
        try {
          log('info', `Processing batch: ${batchId}`);
          
          // Get all orders in the batch
          const orders = await getBatchOrders(batchId);
          
          if (orders.length === 0) {
            log('warn', `No orders found for batch: ${batchId}`);
            continue;
          }
          
          const batchResult = {
            batchOrderId: batchId,
            orderCount: orders.length,
            batchOrderIdFixed: 0,
            orderNumberFixed: 0,
            itemIndexFixed: 0
          };
          
          // Fix batch_order_id
          const batchIdResult = await fixBatchOrderId(batchId, orders);
          batchResult.batchOrderIdFixed = batchIdResult.fixed;
          
          // Fix order_number
          const orderNumberResult = await fixOrderNumbers(batchId, orders);
          batchResult.orderNumberFixed = orderNumberResult.fixed;
          
          // Fix item_index and total_items_in_batch
          const itemIndexResult = await fixItemIndexes(batchId, orders);
          batchResult.itemIndexFixed = itemIndexResult.fixed;
          
          batchResults.push(batchResult);
          
          // Add to global results
          results.batchOrderIdFixed += batchResult.batchOrderIdFixed;
          results.orderNumberFixed += batchResult.orderNumberFixed;
          results.itemIndexFixed += batchResult.itemIndexFixed;
          results.orderCount += batchResult.orderCount;
        } catch (error) {
          log('error', `Error processing batch ${batchId}:`, error);
          results.errors.push({
            batch: batchId,
            error: error.message
          });
        }
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          batchCount: uniqueBatchIds.length,
          results,
          batches: batchResults
        })
      };
    }
    
    // No specific action requested
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Missing required parameters. Provide batchOrderId or set fixAll=true' 
      })
    };
  } catch (error) {
    log('error', 'Unexpected error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error.message
      })
    };
  }
}; 