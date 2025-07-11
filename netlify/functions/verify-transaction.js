/**
 * VERIFY TRANSACTION - FIXED VERSION
 * 
 * Server-side verification of blockchain transactions with improved error handling
 * Properly handles batch orders, single orders, and all payment types
 */

// Enable detailed logging
const DEBUG = true;

/**
 * Enhanced logging function with prefixes and timestamps
 */
function log(level, message, data = null) {
  const prefix = '[VERIFY-TX]';
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

let Connection, PublicKey;
try {
  const solanaWeb3 = require('@solana/web3.js');
  Connection = solanaWeb3.Connection;
  PublicKey = solanaWeb3.PublicKey;
  log('info', 'Successfully loaded Solana web3 packages');
} catch (err) {
  log('error', 'Failed to load @solana/web3.js:', err.message);
}

const { createClient } = require('@supabase/supabase-js');
const { createConnectionWithRetry, verifyTransaction } = require('./shared/rpc-service');

// Environment variables with multiple fallbacks
const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || process.env.VITE_HELIUS_API_KEY || '',
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY || process.env.VITE_ALCHEMY_API_KEY || ''
};

// Initialize Supabase with better error handling
let supabase;
try {
  if (!ENV.SUPABASE_URL || ENV.SUPABASE_URL === 'https://placeholder-url.supabase.co') {
    log('error', 'Missing or invalid SUPABASE_URL environment variable');
  }
  
  if (!ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_SERVICE_ROLE_KEY === 'placeholder-key-for-initialization') {
    log('error', 'Missing or invalid SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  
  if (ENV.SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY && 
      ENV.SUPABASE_URL !== 'https://placeholder-url.supabase.co' && 
      ENV.SUPABASE_SERVICE_ROLE_KEY !== 'placeholder-key-for-initialization') {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    log('info', 'Supabase client initialized successfully');
  } else {
    log('warn', 'Using fallback Supabase values - database operations will likely fail');
    supabase = createClient(
      ENV.SUPABASE_URL || 'https://placeholder-url.supabase.co',
      ENV.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key-for-initialization'
    );
  }
} catch (err) {
  log('error', 'Failed to initialize Supabase client:', err.message);
}

let SOLANA_CONNECTION;
const LAMPORTS_PER_SOL = 1000000000;

/**
 * Verify transaction details against the blockchain
 */
async function verifyTransactionDetails(signature, expectedDetails) {
  log('info', `Starting transaction verification for signature: ${signature?.substring(0, 10)}...`);
  
  try {
    if (!SOLANA_CONNECTION) {
      log('error', 'Solana verification unavailable: No connection available');
      return { 
        isValid: false, 
        error: 'Solana verification is not available. Please try again later.' 
      };
    }

    const result = await verifyTransaction(SOLANA_CONNECTION, signature);
    
    if (!result.isValid) {
      log('warn', 'Transaction validation failed:', result.error);
      return result;
    }
    
    const tx = result.transaction;
    if (!tx || !tx.meta) {
      log('error', 'Transaction object missing or incomplete');
      return {
        isValid: false,
        error: 'Invalid transaction data received'
      };
    }

    // Extract transaction details
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;
    const accounts = tx.transaction.message.getAccountKeys().keySegments().flat();
    
    const transfers = accounts.map((account, index) => {
      const balanceChange = (postBalances[index] - preBalances[index]) / LAMPORTS_PER_SOL;
      return {
        address: account.toBase58(),
        change: balanceChange
      };
    });

    const recipient = transfers.find(t => t.change > 0);
    const sender = transfers.find(t => t.change < 0);

    if (!recipient || !sender) {
      log('error', 'Could not identify transfer details in transaction');
      return { 
        isValid: false, 
        error: 'Could not identify transfer details'
      };
    }
    
    const details = {
      amount: recipient.change,
      buyer: sender.address,
      recipient: recipient.address
    };

    log('info', 'Extracted transaction details:', {
      amount: details.amount,
      buyer: details.buyer?.substring(0, 8) + '...',
      recipient: details.recipient?.substring(0, 8) + '...',
    });

    // Verify against expected details if provided
    if (expectedDetails) {
      if (Math.abs(details.amount - expectedDetails.amount) > 0.00001) {
        log('warn', 'Amount mismatch in transaction verification');
        return {
          isValid: false,
          error: `Amount mismatch: expected ${expectedDetails.amount} SOL, got ${details.amount} SOL`,
          details
        };
      }

      if (details.buyer.toLowerCase() !== expectedDetails.buyer.toLowerCase()) {
        log('warn', 'Buyer mismatch in transaction verification');
        return {
          isValid: false,
          error: `Buyer mismatch: expected ${expectedDetails.buyer}, got ${details.buyer}`,
          details
        };
      }

      if (details.recipient.toLowerCase() !== expectedDetails.recipient.toLowerCase()) {
        log('warn', 'Recipient mismatch in transaction verification');
        return {
          isValid: false,
          error: `Recipient mismatch: expected ${expectedDetails.recipient}, got ${details.recipient}`,
          details
        };
      }
    }

    log('info', 'Transaction verified successfully');
    return { isValid: true, details };
  } catch (error) {
    log('error', 'Error verifying transaction:', error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Failed to verify transaction' 
    };
  }
}

/**
 * Get all orders that should be processed for a given transaction
 */
async function getOrdersForTransaction(signature, orderId = null, batchOrderId = null) {
  log('info', 'Finding orders for transaction', { signature: signature?.substring(0, 8) + '...', orderId, batchOrderId });
  
  let ordersToProcess = [];
  
  try {
    // Strategy 1: If we have a specific batchOrderId, get all orders in that batch
    if (batchOrderId) {
      log('info', `Looking for orders in batch: ${batchOrderId}`);
      
      const { data: batchOrders, error: batchError } = await supabase
        .from('orders')
        .select('id, status, order_number, transaction_signature, payment_metadata, batch_order_id, item_index, total_items_in_batch, amount_sol')
        .eq('batch_order_id', batchOrderId);
        
      if (batchError) {
        log('error', 'Error fetching batch orders:', batchError);
      } else if (batchOrders && batchOrders.length > 0) {
        log('info', `Found ${batchOrders.length} orders in batch ${batchOrderId}`);
        ordersToProcess = batchOrders;
      }
      
      // Also check for orders with batch ID only in metadata
      if (ordersToProcess.length === 0) {
        const { data: metadataOrders, error: metadataError } = await supabase
          .from('orders')
          .select('id, status, order_number, transaction_signature, payment_metadata, batch_order_id, item_index, total_items_in_batch, amount_sol')
          .contains('payment_metadata', { batchOrderId: batchOrderId });
          
        if (!metadataError && metadataOrders && metadataOrders.length > 0) {
          log('info', `Found ${metadataOrders.length} orders with batch ID in metadata`);
          ordersToProcess = metadataOrders;
        }
      }
    }
    
    // Strategy 2: If we have a specific orderId, get that order (and its batch if it exists)
    if (orderId && ordersToProcess.length === 0) {
      log('info', `Looking for specific order: ${orderId}`);
      
      const { data: specificOrder, error: orderError } = await supabase
        .from('orders')
        .select('id, status, order_number, transaction_signature, payment_metadata, batch_order_id, item_index, total_items_in_batch, amount_sol')
        .eq('id', orderId)
        .single();
        
      if (orderError) {
        log('error', 'Error fetching specific order:', orderError);
      } else if (specificOrder) {
        log('info', 'Found specific order');
        
        // If this order is part of a batch, get all orders in the batch
        if (specificOrder.batch_order_id) {
          log('info', `Order is part of batch ${specificOrder.batch_order_id}, getting all batch orders`);
          
          const { data: batchOrders, error: batchError } = await supabase
            .from('orders')
            .select('id, status, order_number, transaction_signature, payment_metadata, batch_order_id, item_index, total_items_in_batch, amount_sol')
            .eq('batch_order_id', specificOrder.batch_order_id);
            
          if (!batchError && batchOrders && batchOrders.length > 0) {
            log('info', `Found ${batchOrders.length} orders in batch`);
            ordersToProcess = batchOrders;
          } else {
            ordersToProcess = [specificOrder];
          }
        } else if (specificOrder.payment_metadata?.batchOrderId) {
          log('info', `Order has batch ID in metadata: ${specificOrder.payment_metadata.batchOrderId}`);
          
          const { data: metadataOrders, error: metadataError } = await supabase
            .from('orders')
            .select('id, status, order_number, transaction_signature, payment_metadata, batch_order_id, item_index, total_items_in_batch, amount_sol')
            .contains('payment_metadata', { batchOrderId: specificOrder.payment_metadata.batchOrderId });
            
          if (!metadataError && metadataOrders && metadataOrders.length > 0) {
            log('info', `Found ${metadataOrders.length} orders with same batch ID in metadata`);
            ordersToProcess = metadataOrders;
          } else {
            ordersToProcess = [specificOrder];
          }
        } else {
          // Single order
          ordersToProcess = [specificOrder];
        }
      }
    }
    
    // Strategy 3: If we still have no orders, look for orders with this transaction signature
    if (ordersToProcess.length === 0) {
      log('info', `Looking for orders with transaction signature: ${signature?.substring(0, 8)}...`);
      
      const { data: signatureOrders, error: signatureError } = await supabase
        .from('orders')
        .select('id, status, order_number, transaction_signature, payment_metadata, batch_order_id, item_index, total_items_in_batch, amount_sol')
        .eq('transaction_signature', signature);
        
      if (!signatureError && signatureOrders && signatureOrders.length > 0) {
        log('info', `Found ${signatureOrders.length} orders with matching signature`);
        ordersToProcess = signatureOrders;
      }
    }
    
    // Strategy 4: Look for recent pending orders that might be waiting for this transaction
    if (ordersToProcess.length === 0) {
      log('info', 'No orders found directly, checking for recent pending orders');
      
      const { data: pendingOrders, error: pendingError } = await supabase
        .from('orders')
        .select('id, status, order_number, transaction_signature, payment_metadata, batch_order_id, item_index, total_items_in_batch, amount_sol')
        .in('status', ['draft', 'pending_payment'])
        .is('transaction_signature', null)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (!pendingError && pendingOrders && pendingOrders.length > 0) {
        log('info', `Found ${pendingOrders.length} recent pending orders without transaction signatures`);
        ordersToProcess = pendingOrders;
      }
    }
    
    log('info', `Total orders to process: ${ordersToProcess.length}`);
    return ordersToProcess;
    
  } catch (error) {
    log('error', 'Error getting orders for transaction:', error);
    return [];
  }
}

/**
 * Update order status with proper state transitions
 */
async function updateOrderStatus(orderId, newStatus, transactionSignature = null, additionalData = {}) {
  log('info', `Updating order ${orderId} to status: ${newStatus}`);
  
  try {
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...additionalData
    };
    
    if (transactionSignature) {
      updateData.transaction_signature = transactionSignature;
    }
    
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);
      
    if (updateError) {
      log('error', `Error updating order ${orderId}:`, updateError);
      return { success: false, error: updateError };
    }
    
    log('info', `Successfully updated order ${orderId} to ${newStatus}`);
    return { success: true };
    
  } catch (error) {
    log('error', `Exception updating order ${orderId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Process and confirm orders for a verified transaction
 */
async function processOrdersForTransaction(orders, signature, verification) {
  log('info', `Processing ${orders.length} orders for transaction ${signature?.substring(0, 8)}...`);
  
  let successCount = 0;
  let errorCount = 0;
  const results = [];
  
  // First, update transaction status if we have a valid verification
  if (verification.isValid) {
    try {
      await supabase.rpc('update_transaction_status', {
        p_signature: signature,
        p_status: 'confirmed',
        p_details: {
          ...verification.details,
          confirmedAt: new Date().toISOString()
        }
      });
      log('info', 'Transaction status updated to confirmed');
    } catch (error) {
      log('warn', 'Failed to update transaction status:', error);
    }
  }
  
  // Group orders by batch if they exist
  const batchGroups = {};
  const singleOrders = [];
  
  for (const order of orders) {
    const batchId = order.batch_order_id || order.payment_metadata?.batchOrderId;
    if (batchId) {
      if (!batchGroups[batchId]) {
        batchGroups[batchId] = [];
      }
      batchGroups[batchId].push(order);
    } else {
      singleOrders.push(order);
    }
  }
  
  // Process batch orders
  for (const [batchId, batchOrders] of Object.entries(batchGroups)) {
    log('info', `Processing batch ${batchId} with ${batchOrders.length} orders`);
    
    try {
      // Ensure all orders in batch have consistent data
      await normalizeBatchOrders(batchId, batchOrders, signature);
      
      // Process each order in the batch
      for (const order of batchOrders) {
        const result = await processIndividualOrder(order, signature, verification);
        results.push(result);
        
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }
      
    } catch (error) {
      log('error', `Error processing batch ${batchId}:`, error);
      errorCount += batchOrders.length;
    }
  }
  
  // Process single orders
  for (const order of singleOrders) {
    const result = await processIndividualOrder(order, signature, verification);
    results.push(result);
    
    if (result.success) {
      successCount++;
    } else {
      errorCount++;
    }
  }
  
  log('info', `Processing complete: ${successCount} successful, ${errorCount} failed`);
  
  return {
    success: successCount > 0,
    successCount,
    errorCount,
    totalOrders: orders.length,
    results
  };
}

/**
 * Normalize batch orders to ensure consistency
 */
async function normalizeBatchOrders(batchId, orders, signature) {
  log('info', `Normalizing batch ${batchId} with ${orders.length} orders`);
  
  try {
    // Update batch_order_id for any orders missing it
    const ordersMissingBatchId = orders.filter(order => !order.batch_order_id);
    if (ordersMissingBatchId.length > 0) {
      const { error: batchUpdateError } = await supabase
        .from('orders')
        .update({ batch_order_id: batchId })
        .in('id', ordersMissingBatchId.map(o => o.id));
        
      if (batchUpdateError) {
        log('error', 'Error updating batch_order_id:', batchUpdateError);
      } else {
        log('info', `Updated batch_order_id for ${ordersMissingBatchId.length} orders`);
      }
    }
    
    // Ensure consistent order numbering
    const sfOrderNumber = orders.find(o => o.order_number?.startsWith('SF-'))?.order_number;
    if (sfOrderNumber) {
      const ordersNeedingUpdate = orders.filter(o => o.order_number !== sfOrderNumber);
      if (ordersNeedingUpdate.length > 0) {
        const { error: orderNumError } = await supabase
          .from('orders')
          .update({ order_number: sfOrderNumber })
          .in('id', ordersNeedingUpdate.map(o => o.id));
          
        if (orderNumError) {
          log('error', 'Error updating order numbers:', orderNumError);
        } else {
          log('info', `Updated order numbers for ${ordersNeedingUpdate.length} orders`);
        }
      }
    }
    
    // Update item indexes
    const totalItems = orders.length;
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (order.item_index !== i + 1 || order.total_items_in_batch !== totalItems) {
        await supabase
          .from('orders')
          .update({
            item_index: i + 1,
            total_items_in_batch: totalItems
          })
          .eq('id', order.id);
      }
    }
    
    log('info', `Batch ${batchId} normalized successfully`);
    
  } catch (error) {
    log('error', `Error normalizing batch ${batchId}:`, error);
  }
}

/**
 * Process an individual order
 */
async function processIndividualOrder(order, signature, verification) {
  log('info', `Processing order ${order.id} (status: ${order.status})`);
  
  try {
    // Calculate order amount
    let orderAmount = 0;
    if (verification.details?.amount) {
      // For batch orders, divide amount evenly unless specific pricing exists
      const batchId = order.batch_order_id || order.payment_metadata?.batchOrderId;
      if (batchId && order.total_items_in_batch > 1) {
        if (order.payment_metadata?.variantKey && order.payment_metadata?.variantPrices) {
          const variantKey = order.payment_metadata.variantKey;
          const variantPrice = order.payment_metadata.variantPrices[variantKey];
          orderAmount = variantPrice ? parseFloat(variantPrice) : 0;
        } else if (order.payment_metadata?.originalPrice) {
          const originalPrice = parseFloat(order.payment_metadata.originalPrice || 0);
          const couponDiscount = parseFloat(order.payment_metadata.couponDiscount || 0);
          orderAmount = Math.max(0, originalPrice - couponDiscount);
        } else {
          orderAmount = verification.details.amount / order.total_items_in_batch;
        }
      } else {
        orderAmount = verification.details.amount;
      }
    }
    
    // Handle different order statuses
    if (order.status === 'draft') {
      log('info', `Order ${order.id} is draft, updating to pending_payment`);
      
      const result = await updateOrderStatus(order.id, 'pending_payment', signature, {
        amount_sol: orderAmount
      });
      
      if (!result.success) {
        return { success: false, orderId: order.id, error: result.error };
      }
      
      // Now update to confirmed
      const confirmResult = await updateOrderStatus(order.id, 'confirmed');
      return { success: confirmResult.success, orderId: order.id, error: confirmResult.error };
      
    } else if (order.status === 'pending_payment') {
      log('info', `Order ${order.id} is pending_payment, updating to confirmed`);
      
      // Update transaction signature if missing
      if (!order.transaction_signature || order.transaction_signature !== signature) {
        await updateOrderStatus(order.id, 'pending_payment', signature, {
          amount_sol: orderAmount
        });
      }
      
      // Update to confirmed
      const result = await updateOrderStatus(order.id, 'confirmed');
      return { success: result.success, orderId: order.id, error: result.error };
      
    } else if (order.status === 'confirmed') {
      log('info', `Order ${order.id} is already confirmed`);
      return { success: true, orderId: order.id, alreadyConfirmed: true };
      
    } else {
      log('warn', `Order ${order.id} has unexpected status: ${order.status}`);
      return { success: false, orderId: order.id, error: `Cannot process order in ${order.status} status` };
    }
    
  } catch (error) {
    log('error', `Error processing order ${order.id}:`, error);
    return { success: false, orderId: order.id, error: error.message };
  }
}

/**
 * Handle non-blockchain payments (Stripe, free orders, etc.)
 */
async function processNonBlockchainPayment(signature, orderId, batchOrderId) {
  log('info', `Processing non-blockchain payment: ${signature?.substring(0, 10)}...`);
  
  try {
    // Get orders to process
    const orders = await getOrdersForTransaction(signature, orderId, batchOrderId);
    
    if (orders.length === 0) {
      log('warn', 'No orders found for non-blockchain payment');
      return {
        success: false,
        error: 'No orders found for this payment'
      };
    }
    
    // Create a mock verification for non-blockchain payments
    const mockVerification = {
      isValid: true,
      details: {
        amount: 0, // Will be calculated per order
        paymentMethod: signature.startsWith('pi_') ? 'stripe' : 'other'
      }
    };
    
    // Process the orders
    const result = await processOrdersForTransaction(orders, signature, mockVerification);
    
    return {
      success: result.success,
      ordersUpdated: result.successCount,
      totalOrders: result.totalOrders,
      message: `${signature.startsWith('pi_') ? 'Stripe' : 'Non-blockchain'} payment processed`
    };
    
  } catch (error) {
    log('error', 'Error processing non-blockchain payment:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main handler function
 */
exports.handler = async (event, context) => {
  log('info', 'Function invoked', { 
    httpMethod: event.httpMethod,
    hasAuthHeader: !!event.headers.authorization
  });
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check if Supabase client is available
  if (!supabase) {
    log('error', 'Supabase client is not initialized');
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false,
        error: 'Database connection is not available'
      })
    };
  }

  // Initialize Solana connection if needed
  if (!SOLANA_CONNECTION && Connection) {
    try {
      log('info', 'Initializing Solana connection...');
      SOLANA_CONNECTION = await createConnectionWithRetry(ENV);
    } catch (err) {
      log('error', 'Failed to initialize Solana connection:', err.message);
    }
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

  const { orderId, signature, expectedDetails, batchOrderId, isBatchOrder } = requestBody;

  if (!signature) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing transaction signature' })
    };
  }

  log('info', 'Processing verification request', { 
    signature: signature?.substring(0, 10) + '...',
    orderId: orderId || 'none',
    batchOrderId: batchOrderId || 'none',
    hasExpectedDetails: !!expectedDetails
  });

  try {
    // Handle non-blockchain payments
    if (signature.startsWith('pi_') || signature.startsWith('free_')) {
      const result = await processNonBlockchainPayment(signature, orderId, batchOrderId);
      
      return {
        statusCode: result.success ? 200 : 400,
        body: JSON.stringify(result)
      };
    }

    // Handle blockchain payments
    if (!SOLANA_CONNECTION) {
      log('error', 'Solana connection not available');
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false,
          error: 'Blockchain verification is not available'
        })
      };
    }

    // Verify the transaction on blockchain
    const verification = await verifyTransactionDetails(signature, expectedDetails);
    
    if (!verification.isValid) {
      log('warn', 'Transaction verification failed');
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          success: false,
          error: verification.error,
          verification
        })
      };
    }

    // Get orders to process
    const orders = await getOrdersForTransaction(signature, orderId, batchOrderId);
    
    if (orders.length === 0) {
      log('warn', 'No orders found for verified transaction');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          warning: 'Transaction verified but no related orders found',
          verification,
          ordersUpdated: 0
        })
      };
    }

    // Process the orders
    const result = await processOrdersForTransaction(orders, signature, verification);
    
    return {
      statusCode: result.success ? 200 : 400,
      body: JSON.stringify({
        success: result.success,
        verification,
        ordersUpdated: result.successCount,
        totalOrders: result.totalOrders,
        message: result.success ? 'Orders processed successfully' : 'Some orders failed to process'
      })
    };

  } catch (error) {
    log('error', 'Unexpected error in handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};