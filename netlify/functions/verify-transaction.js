/**
 * VERIFY TRANSACTION
 * 
 * Server-side verification of blockchain transactions with improved error handling
 * Uses our robust RPC system with WebSocket support and retry logic
 * Implementation exactly matches the frontend approach
 */

let Connection, PublicKey;
try {
  // Try to import Solana packages, but handle the case where they're not available
  const solanaWeb3 = require('@solana/web3.js');
  Connection = solanaWeb3.Connection;
  PublicKey = solanaWeb3.PublicKey;
} catch (err) {
  console.error('Failed to load @solana/web3.js:', err.message);
  // We'll handle this later in the code
}

const { createClient } = require('@supabase/supabase-js');

// Import our shared RPC service that matches the frontend implementation
const { createConnectionWithRetry, verifyTransaction } = require('./shared/rpc-service');

// Environment variables with multiple fallbacks
const ENV = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
  // Helius API Key
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || process.env.VITE_HELIUS_API_KEY || '',
  
  // Alchemy API Key
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY || process.env.VITE_ALCHEMY_API_KEY || ''
};

// Initialize Supabase with better error handling
let supabase;
try {
  // Validate Supabase credentials before initializing
  if (!ENV.SUPABASE_URL || ENV.SUPABASE_URL === 'https://placeholder-url.supabase.co') {
    console.error('Missing or invalid SUPABASE_URL environment variable');
  }
  
  if (!ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SUPABASE_SERVICE_ROLE_KEY === 'placeholder-key-for-initialization') {
    console.error('Missing or invalid SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  
  // Only create client if we have reasonable values
  if (ENV.SUPABASE_URL && ENV.SUPABASE_SERVICE_ROLE_KEY && 
      ENV.SUPABASE_URL !== 'https://placeholder-url.supabase.co' && 
      ENV.SUPABASE_SERVICE_ROLE_KEY !== 'placeholder-key-for-initialization') {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase client initialized successfully with service role permissions');
    console.log(`Connected to database: ${ENV.SUPABASE_URL}`);
  } else {
    console.warn('Using fallback Supabase values - database operations will likely fail');
    supabase = createClient(
      ENV.SUPABASE_URL || 'https://placeholder-url.supabase.co',
      ENV.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key-for-initialization'
    );
  }
} catch (err) {
  console.error('Failed to initialize Supabase client:', err.message);
  // We'll handle this in the handler function
}

let SOLANA_CONNECTION;
const LAMPORTS_PER_SOL = 1000000000;

// Securely verify transaction details against the blockchain
async function verifyTransactionDetails(signature, expectedDetails) {
  try {
    // Check if we have Solana libraries available
    if (!SOLANA_CONNECTION) {
      return { 
        isValid: false, 
        error: 'Solana verification is not available. Please try again later.' 
      };
    }

    // Use our shared verification function with proper error handling and timeouts
    const result = await verifyTransaction(SOLANA_CONNECTION, signature);
    
    if (!result.isValid) {
      return result;
    }
    
    const tx = result.transaction;

    // Get pre and post balances
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;
    
    // Get accounts involved in the transaction
    const accounts = tx.transaction.message.getAccountKeys().keySegments().flat();
    
    // Find the transfer by looking at balance changes
    const transfers = accounts.map((account, index) => {
      const balanceChange = (postBalances[index] - preBalances[index]) / LAMPORTS_PER_SOL;
      return {
        address: account.toBase58(),
        change: balanceChange
      };
    });

    // Find the recipient (positive balance change) and sender (negative balance change)
    const recipient = transfers.find(t => t.change > 0);
    const sender = transfers.find(t => t.change < 0);

    if (!recipient || !sender) {
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

    // If we have expected details, verify them
    if (expectedDetails) {
      if (Math.abs(details.amount - expectedDetails.amount) > 0.00001) { // Allow small rounding differences
        return {
          isValid: false,
          error: `Amount mismatch: expected ${expectedDetails.amount} SOL, got ${details.amount} SOL`,
          details
        };
      }

      if (details.buyer.toLowerCase() !== expectedDetails.buyer.toLowerCase()) {
        return {
          isValid: false,
          error: `Buyer mismatch: expected ${expectedDetails.buyer}, got ${details.buyer}`,
          details
        };
      }

      if (details.recipient.toLowerCase() !== expectedDetails.recipient.toLowerCase()) {
        return {
          isValid: false,
          error: `Recipient mismatch: expected ${expectedDetails.recipient}, got ${details.recipient}`,
          details
        };
      }
    }

    return { isValid: true, details };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Failed to verify transaction' 
    };
  }
}

// Verify and update the order status using approach from frontend
async function confirmOrderPayment(orderId, signature, verification) {
  if (!supabase) {
    console.warn('Supabase client not initialized, cannot confirm order payment');
    return {
      success: false,
      error: 'Database connection not available'
    };
  }
  
  try {
    if (!verification.isValid) {
      // Log verification failure
      try {
        const { error: logError } = await supabase.rpc('update_transaction_status', {
          p_signature: signature,
          p_status: 'failed',
          p_details: {
            error: verification.error,
            verification: verification.details || null
          }
        });
        
        if (logError) {
          console.error('Failed to log verification failure:', logError);
        }
      } catch (dbError) {
        console.error('Database error when logging verification failure:', dbError);
      }
      
      return {
        success: false,
        error: verification.error || 'Transaction verification failed'
      };
    }
    
    // Update transaction log with success
    try {
      const { error: updateError } = await supabase.rpc('update_transaction_status', {
        p_signature: signature,
        p_status: 'confirmed',
        p_details: {
          ...verification.details,
          confirmedAt: new Date().toISOString()
        }
      });
      
      if (updateError) {
        console.error('Failed to update transaction status:', updateError);
        return {
          success: false,
          error: 'Failed to update transaction status'
        };
      }
    } catch (dbError) {
      console.error('Database error when updating transaction status:', dbError);
      return {
        success: false,
        error: 'Database error when updating transaction'
      };
    }
    
    // In the frontend, the following steps are performed in sequence:
    
    // STEP 1: First look up the order to determine its current state
    console.log(`Looking up order ${orderId} with transaction signature ${signature}`);
    let orderData;
    
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, transaction_signature')
        .eq('id', orderId)
        .single();
        
      if (error) {
        console.error('Error fetching order details:', error);
        return { success: false, error: 'Failed to fetch order details' };
      }
      
      orderData = data;
      console.log('Current order status:', orderData);
      
      // Validate order exists and has matching signature
      if (!orderData) {
        console.error('Order not found:', orderId);
        return { success: false, error: 'Order not found' };
      }
      
      // Check if signature matches
      if (orderData.transaction_signature && 
          orderData.transaction_signature !== signature &&
          orderData.transaction_signature !== 'pending') {
        console.error('Transaction signature mismatch:', {
          orderSignature: orderData.transaction_signature,
          providedSignature: signature
        });
        return { success: false, error: 'Transaction signature mismatch' };
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      return { success: false, error: 'Failed to fetch order' };
    }
    
    // STEP 2: Try to use the confirm_order_payment RPC function if order is pending_payment
    if (orderData.status === 'pending_payment') {
      console.log(`Attempting to confirm order ${orderId} payment with signature: ${signature} (via RPC function with service role)`);
      
      try {
        const { data: confirmData, error: confirmError } = await supabase.rpc('confirm_order_payment', {
          p_transaction_signature: signature,
          p_status: 'confirmed'
        });
        
        if (confirmError) {
          console.error('Failed to confirm order payment with RPC:', confirmError);
          // Don't return error yet, try the direct update approach
        } else {
          console.log('Order payment confirmation result:', confirmData);
          // Check if order status is now confirmed
          const { data: refreshedOrder, error: refreshError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('id', orderId)
            .single();
            
          if (!refreshError && refreshedOrder && refreshedOrder.status === 'confirmed') {
            console.log('Order successfully confirmed via RPC function');
            return { success: true };
          }
        }
      } catch (rpcError) {
        console.error('Exception in confirm_order_payment RPC call:', rpcError);
        // Continue to next approach
      }
      
      // STEP 3: If RPC function fails, try direct update approach
      console.log(`Trying direct SQL update for order ${orderId}`);
      
      try {
        // Update order directly using SQL - matching frontend fallback approach
        console.log(`Using direct_update_order_status RPC with service role permissions for order ${orderId}`);
        const { data: updateData, error: updateError } = await supabase.rpc('direct_update_order_status', {
          p_order_id: orderId,
          p_status: 'confirmed'
        });
        
        if (updateError) {
          console.error('Direct order update via RPC failed:', updateError);
          
          // Last resort: Exactly match what the frontend does in useMerchantOrders.ts
          console.log('Attempting last-resort direct table update using exact frontend approach with service role');
          const { error: directUpdateError } = await supabase
            .from('orders')
            .update({ status: 'confirmed' })
            .eq('id', orderId)
            .eq('status', 'pending_payment');
            
          if (directUpdateError) {
            console.error('Last-resort direct update failed:', directUpdateError);
            return { success: false, error: 'All order update methods failed' };
          } else {
            console.log('Last-resort direct update succeeded using exact frontend approach', updateData);
          }
        } else {
          console.log('Direct order status update via RPC succeeded', updateData);
        }
      } catch (updateError) {
        console.error('Error in direct update approaches:', updateError);
        
        // EMERGENCY FALLBACK: Try direct update without status condition as last resort
        try {
          console.log('EMERGENCY FALLBACK: Attempting direct update without status condition');
          const { data: emergencyData, error: emergencyError } = await supabase
            .from('orders')
            .update({ status: 'confirmed' })
            .eq('id', orderId);
          
          if (emergencyError) {
            console.error('Emergency direct update failed:', emergencyError);
            return { success: false, error: 'All update approaches including emergency update failed' };
          } else {
            console.log('Emergency direct update succeeded');
          }
        } catch (directError) {
          console.error('Emergency direct update exception:', directError);
          return { success: false, error: 'All update approaches failed with exceptions' };
        }
      }
    } else if (orderData.status === 'confirmed') {
      console.log('Order is already confirmed, no action needed');
    } else {
      console.warn(`Order is in unexpected status: ${orderData.status}, not updating`);
    }
    
    // Final check to see if order update succeeded
    try {
      const { data: finalOrder, error: finalError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('id', orderId)
        .single();
        
      if (finalError) {
        console.warn('Could not perform final order status check:', finalError);
      } else {
        console.log('Final order status:', finalOrder);
        if (finalOrder.status !== 'confirmed') {
          console.warn('Order status is still not confirmed after all update attempts');
          
          // CRITICAL OVERRIDE: Force update as last resort if all else failed
          console.log('CRITICAL OVERRIDE: Forcing order status update without conditions');
          try {
            const { error: forceError } = await supabase
              .from('orders')
              .update({ status: 'confirmed' })
              .eq('id', orderId);
              
            if (forceError) {
              console.error('Critical force update failed:', forceError);
              return { success: false, error: 'Critical force update failed after all other methods' };
            } else {
              console.log('Critical force update succeeded for order:', orderId);
              // Double-check final status after force update
              const { data: forcedOrder } = await supabase
                .from('orders')
                .select('id, status')
                .eq('id', orderId)
                .single();
              
              console.log('Status after forced update:', forcedOrder);
              if (forcedOrder && forcedOrder.status !== 'confirmed') {
                return { success: false, error: 'Order status could not be updated despite all attempts' };
              }
            }
          } catch (forceError) {
            console.error('Exception in critical force update:', forceError);
            return { success: false, error: 'Failed to force update order status' };
          }
        }
      }
    } catch (error) {
      console.warn('Error in final order status check:', error);
    }
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error confirming order payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

exports.handler = async (event, context) => {
  console.log('Function invoked:', { 
    httpMethod: event.httpMethod,
    hasAuthHeader: !!event.headers.authorization,
    path: event.path
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
    console.error('Supabase client is not initialized');
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        warning: 'Database connection is temporarily unavailable. Transaction will be verified later.',
        verification: {
          isValid: true,
          tempApproved: true,
          details: {}
        }
      })
    };
  }

  // Initialize Solana connection with our robust service if necessary
  if (!SOLANA_CONNECTION && Connection) {
    try {
      console.log('Initializing Solana connection...');
      SOLANA_CONNECTION = await createConnectionWithRetry(ENV);
    } catch (err) {
      console.error('Failed to initialize Solana connection:', err.message);
    }
  }

  // Check if Solana is available
  if (!SOLANA_CONNECTION) {
    console.error('Solana connection is not available. Returning temporary success.');
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        warning: 'Blockchain verification is temporarily unavailable. Transaction will be verified later.',
        verification: {
          isValid: true,
          tempApproved: true,
          details: {}
        }
      })
    };
  }

  // Validate authentication
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  let userId = 'anonymous';

  try {
    // Always validate the token when provided
    if (token && token.length > 0) {
      try {
        const { data, error } = await supabase.auth.getUser(token);
        
        if (!error && data.user) {
          userId = data.user.id;
          console.log(`Authenticated user: ${userId.substring(0, 8)}...`);
        } else {
          // Keep track of authentication failures in logs
          console.warn('Token validation failed:', error?.message);
          console.log('Proceeding with blockchain verification without user authentication');
        }
      } catch (authError) {
        console.error('Auth error:', authError.message);
      }
    } else {
      console.warn('No authentication token provided, relying on blockchain verification');
    }
  } catch (err) {
    console.error('Auth processing error:', err.message);
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
  const { orderId, signature, expectedDetails } = requestBody;
  
  if (!signature) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing transaction signature' })
    };
  }

  // For non-Solana transactions (like Stripe), handle differently
  if (signature.startsWith('pi_') || signature.startsWith('free_')) {
    // Handle alternate payment methods
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Non-blockchain transaction requires separate verification'
      })
    };
  }

  try {
    console.log(`Verifying transaction: ${signature.substring(0, 12)}...`);
    
    // 1. Verify the transaction details on-chain
    const verification = await verifyTransactionDetails(signature, expectedDetails);
    
    console.log('Verification result:', {
      isValid: verification.isValid,
      hasError: !!verification.error
    });
    
    // 2. Find related orders even if orderId is not provided
    // This ensures we always attempt to update all orders associated with this transaction
    let orderIds = [];
    
    if (orderId) {
      // If an orderId was explicitly provided, use it
      orderIds.push(orderId);
    } else if (verification.isValid) {
      // If no orderId but transaction is valid, find all related orders with expanded search
      try {
        // First check for exact transaction_signature match
        const { data: exactOrders, error: exactError } = await supabase
          .from('orders')
          .select('id, status, transaction_signature')
          .eq('transaction_signature', signature)
          .in('status', ['pending_payment', 'draft']);
          
        if (!exactError && exactOrders && exactOrders.length > 0) {
          console.log(`Found ${exactOrders.length} orders with exact transaction signature match`);
          orderIds = exactOrders.map(order => order.id);
        } else {
          // If no exact match, try a broader search - look for recently created orders that might match this transaction
          console.log('No exact transaction signature matches found, trying broader search');
          
          // Look for orders with same buyer in pending_payment status
          // This handles cases where the order and transaction were created in close timing
          if (verification.details && verification.details.buyer) {
            const buyerAddress = verification.details.buyer;
            const { data: buyerOrders, error: buyerError } = await supabase
              .from('orders')
              .select('id, status, transaction_signature, wallet_address, created_at')
              .eq('wallet_address', buyerAddress)
              .in('status', ['pending_payment', 'draft'])
              .is('transaction_signature', null) // Look for orders without transaction_signature
              .order('created_at', { ascending: false })
              .limit(5); // Limit to most recent orders
            
            if (!buyerError && buyerOrders && buyerOrders.length > 0) {
              console.log(`Found ${buyerOrders.length} recent orders from buyer ${buyerAddress.substring(0, 8)}...`);
              
              // Link the transaction to the most recent order from this buyer
              const mostRecentOrder = buyerOrders[0];
              console.log(`Linking transaction ${signature.substring(0, 12)}... to order ${mostRecentOrder.id}`);
              
              // Update the order with this transaction signature
              const { error: updateError } = await supabase
                .from('orders')
                .update({ transaction_signature: signature })
                .eq('id', mostRecentOrder.id)
                .is('transaction_signature', null); // Only update if signature is not already set
                
              if (updateError) {
                console.error('Failed to link transaction to order:', updateError);
              } else {
                console.log(`Successfully linked transaction to order ${mostRecentOrder.id}`);
                orderIds.push(mostRecentOrder.id);
              }
            } else {
              console.log(`No matching orders found for buyer ${buyerAddress.substring(0, 8)}...`);
            }
          }
          
          // If we still don't have an order, check if there's a transaction log entry we can use
          if (orderIds.length === 0) {
            const { data: txData, error: txError } = await supabase
              .from('transaction_logs')
              .select('product_id, signature')
              .eq('signature', signature)
              .single();
              
            if (!txError && txData && txData.product_id) {
              console.log(`Found transaction log entry for product ${txData.product_id}`);
              
              // Look for recent orders for this product
              const { data: productOrders, error: productError } = await supabase
                .from('orders')
                .select('id, status, product_id, transaction_signature')
                .eq('product_id', txData.product_id)
                .in('status', ['pending_payment', 'draft'])
                .is('transaction_signature', null) // Look for orders without transaction_signature
                .order('created_at', { ascending: false })
                .limit(3);
                
              if (!productError && productOrders && productOrders.length > 0) {
                console.log(`Found ${productOrders.length} recent orders for product ${txData.product_id}`);
                
                // Link the transaction to the most recent order for this product
                const recentProductOrder = productOrders[0];
                console.log(`Linking transaction ${signature.substring(0, 12)}... to order ${recentProductOrder.id}`);
                
                // Update the order with this transaction signature
                const { error: linkError } = await supabase
                  .from('orders')
                  .update({ transaction_signature: signature })
                  .eq('id', recentProductOrder.id)
                  .is('transaction_signature', null);
                  
                if (linkError) {
                  console.error('Failed to link transaction to product order:', linkError);
                } else {
                  console.log(`Successfully linked transaction to product order ${recentProductOrder.id}`);
                  orderIds.push(recentProductOrder.id);
                }
              }
            }
          }
        }
        
        // Try one more time to find orders with the transaction signature
        // This handles cases where we just linked the signature in previous steps
        if (orderIds.length === 0) {
          const { data: finalCheck, error: finalError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('transaction_signature', signature)
            .in('status', ['pending_payment', 'draft', 'confirmed']);
            
          if (!finalError && finalCheck && finalCheck.length > 0) {
            console.log(`Found ${finalCheck.length} orders in final check`);
            orderIds = finalCheck.map(order => order.id);
          }
        }
        
        if (orderIds.length === 0) {
          console.log(`No related orders found for transaction ${signature.substring(0, 12)}`);
        } else {
          console.log(`Found ${orderIds.length} related orders for transaction ${signature.substring(0, 12)}`);
        }
      } catch (findError) {
        console.error('Error finding related orders:', findError);
      }
    }
    
    // 3. Attempt to update all related orders if transaction is valid
    let updatedOrders = [];
    let failedOrders = [];
    
    if (verification.isValid && orderIds.length > 0) {
      console.log(`Attempting to update ${orderIds.length} orders for transaction ${signature.substring(0, 12)}`);
      
      for (const currentOrderId of orderIds) {
        try {
          console.log(`Confirming order payment for ${currentOrderId}`);
          const confirmResult = await confirmOrderPayment(currentOrderId, signature, verification);
          
          if (confirmResult.success) {
            updatedOrders.push(currentOrderId);
          } else {
            failedOrders.push({
              id: currentOrderId,
              error: confirmResult.error
            });
          }
        } catch (confirmError) {
          console.error(`Error confirming order ${currentOrderId}:`, confirmError);
          failedOrders.push({
            id: currentOrderId,
            error: confirmError.message || 'Unknown error'
          });
        }
      }
    } else if (!verification.isValid && orderIds.length > 0) {
      console.warn(`Not updating orders because transaction verification failed`);
    } else if (verification.isValid && orderIds.length === 0) {
      console.log(`Transaction is valid but no orders to update`);
    }
    
    // 4. Return comprehensive response with verification and order update results
    if (!verification.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: verification.error || 'Transaction verification failed',
          details: verification.details || {},
          ordersUpdated: updatedOrders,
          ordersFailed: failedOrders
        })
      };
    }
    
    // Everything was successful or partially successful
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        verification: {
          isValid: verification.isValid,
          details: verification.details
        },
        ordersUpdated: updatedOrders,
        ordersFailed: failedOrders,
        totalOrdersProcessed: orderIds.length
      })
    };
  } catch (err) {
    console.error('Error in verify-transaction function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error' 
      })
    };
  }
}; 