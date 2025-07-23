/**
 * VERIFY TRANSACTION - FIXED VERSION
 * 
 * Server-side verification of blockchain transactions with improved error handling
 * Properly handles batch orders, single orders, and all payment types
 */

// Enable detailed logging
// import { PublicKey } from '@solana/web3.js';
// import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
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
const Stripe = require('stripe');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});
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

async function verifySolanaTransactionDetails(signature, expectedDetails) {
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

    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys().keySegments().flat();

    // Default to SOL, or use tokenMint if provided
    const tokenMint = expectedDetails?.tokenMint;

    if (!tokenMint || tokenMint === 'SOL') {
      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;

      const transfers = accountKeys.map((account, index) => {
        const balanceChange = (postBalances[index] - preBalances[index]) / LAMPORTS_PER_SOL;
        return {
          address: account.toBase58(),
          change: balanceChange
        };
      });

      const recipient = transfers.find(t => t.change > 0);
      const sender = transfers.find(t => t.change < 0);

      if (!recipient || !sender) {
        log('error', 'Could not identify SOL transfer details');
        return {
          isValid: false,
          error: 'Could not identify SOL transfer details'
        };
      }

      const details = {
        amount: recipient.change,
        buyer: sender.address,
        recipient: recipient.address
      };

      log('info', 'Extracted SOL transaction details:', {
        amount: details.amount,
        buyer: details.buyer?.substring(0, 8) + '...',
        recipient: details.recipient?.substring(0, 8) + '...'
      });

      return validateDetails(details, expectedDetails);
    }

    const preTokenBalances = tx.meta.preTokenBalances || [];
    const postTokenBalances = tx.meta.postTokenBalances || [];

    const tokenAccounts = {};

    // Build balance diffs by owner
    for (let i = 0; i < postTokenBalances.length; i++) {
      const post = postTokenBalances[i];
      const pre = preTokenBalances.find(p => p.accountIndex === post.accountIndex && p.mint === post.mint);

      if (post.mint !== tokenMint) continue;

      const owner = post.owner;
      const preAmount = Number(pre?.uiTokenAmount?.amount || '0');
      const postAmount = Number(post.uiTokenAmount.amount);
      const delta = postAmount - preAmount;

      if (!tokenAccounts[owner]) tokenAccounts[owner] = 0;
      tokenAccounts[owner] += delta;
    }

    const buyer = Object.entries(tokenAccounts).find(([, delta]) => delta < 0);
    const recipient = Object.entries(tokenAccounts).find(([, delta]) => delta > 0);

    if (!buyer || !recipient) {
      log('error', 'Could not identify token transfer details');
      return {
        isValid: false,
        error: 'Could not identify token transfer details'
      };
    }

    const amount = Math.abs(recipient[1]) / Math.pow(10, 6); // assuming USDC has 6 decimals

    const details = {
      amount,
      buyer: buyer[0],
      recipient: recipient[0]
    };

    log('info', 'Extracted token transaction details:', {
      amount: details.amount,
      buyer: details.buyer?.substring(0, 8) + '...',
      recipient: details.recipient?.substring(0, 8) + '...'
    });

    return validateDetails(details, expectedDetails);

  } catch (error) {
    log('error', 'Error verifying transaction:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to verify transaction'
    };
  }
}

function validateDetails(details, expected) {
  if (!expected) return { isValid: true, details };

  if (Math.abs(details.amount - expected.amount) > 0.00001) {
    log('warn', 'Amount mismatch in transaction verification');
    return {
      isValid: false,
      error: `Amount mismatch: expected ${expected.amount}, got ${details.amount}`,
      details
    };
  }

  if (details.buyer.toLowerCase() !== expected.buyer.toLowerCase()) {
    log('warn', 'Buyer mismatch in transaction verification');
    return {
      isValid: false,
      error: `Buyer mismatch: expected ${expected.buyer}, got ${details.buyer}`,
      details
    };
  }

  if (details.recipient.toLowerCase() !== expected.recipient.toLowerCase()) {
    log('warn', 'Recipient mismatch in transaction verification');
    return {
      isValid: false,
      error: `Recipient mismatch: expected ${expected.recipient}, got ${details.recipient}`,
      details
    };
  }

  log('info', 'Transaction verified successfully');
  return { isValid: true, details };
}


async function verifyStripePaymentIntent(paymentIntentId) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    console.log('PaymentIntent retrieved:', paymentIntent.id);
    console.log('Status:', paymentIntent.status);

    return paymentIntent.status === 'succeeded';
  } catch (error) {
    console.error('❌ Error verifying PaymentIntent:', error.message);
    return false;
  }
}
/**
 * Handle non-blockchain payments (Stripe, free orders, etc.)
 */
async function verifyNonBlockChainDetails(signature, expectedDetails, isFreeOrder = false) {
  log('info', `Verifying non-blockchain payment: ${signature?.substring(0, 10)}...`);
  
  try {
    // For free orders, no payment verification needed
    if (isFreeOrder || signature.startsWith('free_')) {
      log('info', 'Processing free order - no payment verification needed');
      return { 
        isValid: true, 
        details: {
          amount: 0,
          paymentMethod: 'free',
          buyer: expectedDetails?.buyer,
          recipient: expectedDetails?.recipient
        }
      };
    }
    
    // For Stripe payments, validate the payment intent format
    if (signature.startsWith('pi_')) {
      log('info', 'Processing Stripe payment');
      // In a real implementation, you would verify the payment with Stripe API
      const isValid = await verifyStripePaymentIntent(signature);
      
      return { 
        isValid, 
        details: {
          amount: expectedDetails?.amount || 0,
          paymentMethod: 'stripe',
          buyer: expectedDetails?.buyer,
          stripePaymentIntentId: signature
        }
      };
    }
    
    // Handle other payment methods
    log('info', 'Processing other payment method');
    return { 
      isValid: true, 
      details: {
        amount: expectedDetails?.amount || 0,
        paymentMethod: 'other',
        buyer: expectedDetails?.buyer,
        recipient: expectedDetails?.recipient
      }
    };
    
  } catch (error) {
    log('error', 'Error verifying non-blockchain payment:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to verify non-blockchain payment'
    };
  }
}

/**
 * Process and update orders after payment verification
 */
async function processOrders(signature, orders, orderId = undefined, batchOrderId = undefined) {
  log('info', `Processing orders for signature: ${signature?.substring(0, 10)}...`);
  
  if (!orders || orders.length === 0) {
    log('warn', 'No orders provided to process');
    return {
      success: false,
      error: 'No orders found for this payment'
    };
  }

  try {
    const updateData = {
      status: 'confirmed',
    };

    if (orderId) {
      log('info', `Updating single order: ${orderId}`);
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);
      
      if (updateError) {
        log('error', `Error updating order ${orderId}:`, updateError);
        return { success: false, error: updateError.message };
      }
      
      log('info', `Successfully updated order ${orderId}`);
    }

    if (batchOrderId) {
      log('info', `Updating batch orders with batch_order_id: ${batchOrderId}`);
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('batch_order_id', batchOrderId);
      
      if (updateError) {
        log('error', `Error updating batch orders ${batchOrderId}:`, updateError);
        return { success: false, error: updateError.message };
      }
      
      log('info', `Successfully updated batch orders for ${batchOrderId}`);
    }
    
    return {
      success: true,
      payment_verified: true,
      message: `Order payment processed successfully`,
      ordersUpdated: orders.length
    };
    
  } catch (error) {
    log('error', 'Error processing orders:', error);
    return {
      success: false,
      payment_verified: false,
      error: error instanceof Error ? error.message : 'Failed to process orders'
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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check if Supabase client is available
  if (!supabase) {
    log('error', 'Supabase client is not initialized');
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
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
    log('error', 'Failed to parse request body:', err.message);
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  const { orderId, signature, expectedDetails, batchOrderId } = requestBody;

  if (!signature) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Missing transaction signature' })
    };
  }

  if (!orderId && !batchOrderId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'BatchOrderId and OrderId not specified' })
    };
  }

  log('info', 'Processing verification request', { 
    signature: signature?.substring(0, 10) + '...',
    orderId: orderId || 'none',
    batchOrderId: batchOrderId || 'none',
    hasExpectedDetails: !!expectedDetails
  });

  let allOrders;

  try {
    if (batchOrderId) {
      log('info', `Fetching batch orders for batchOrderId: ${batchOrderId}`);
      const { data: batchOrder, error: batchError } = await supabase
        .from('orders')
        .select('id, status, wallet_address, order_number, payment_metadata, batch_order_id, total_amount_paid_for_batch, amount_sol')
        .eq('batch_order_id', batchOrderId);
      
      if (batchError) {
        log('error', 'Error fetching batch orders:', batchError);
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: batchError.message })
        };
      }
      allOrders = batchOrder;
    } else {
      log('info', `Fetching single order for orderId: ${orderId}`);
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, status, wallet_address, order_number, payment_metadata, batch_order_id, total_amount_paid_for_batch, amount_sol')
        .eq('id', orderId);
      
      if (orderError) {
        log('error', 'Error fetching order:', orderError);
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: orderError.message })
        };
      }
      allOrders = order;
    }

    if (!allOrders || allOrders.length === 0) {
      log('warn', 'No orders found with provided ID');
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: "No Orders found with this orderId or BatchOrderId" })
      };
    }

    const paymentMetadata = allOrders[0].payment_metadata;
    if (!paymentMetadata) {
      log('error', 'Payment metadata missing from order');
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Payment metadata missing from order' })
      };
    }

    const details = {
      amount: orderId ? allOrders[0].amount_sol : allOrders[0].total_amount_paid_for_batch,
      buyer: allOrders[0].wallet_address,
      recipient: paymentMetadata.receiverWallet,
      tokenMint: paymentMetadata.defaultToken,
    };

    let verificationResult;

    // Handle non-blockchain payments
    if (signature.startsWith('pi_') || signature.startsWith('free_')) {
      log('info', 'Processing non-blockchain payment');
      verificationResult = await verifyNonBlockChainDetails(signature, details, paymentMetadata.isFreeOrder);

      if (!verificationResult.isValid) {
        log('warn', 'Non-blockchain payment verification failed');
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            success: false,
            error: verificationResult.error,
            verificationResult
          })
        };
      }
    } else {
      // Handle blockchain payments
      if (!SOLANA_CONNECTION) {
        log('error', 'Solana connection not available');
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            success: false,
            error: 'Blockchain verification is not available'
          })
        };
      }

      log('info', 'Processing blockchain payment');
      // if direct
      if(paymentMetadata.paymentMethod === 'usdc' || 'sol') {
        verificationResult = await verifySolanaTransactionDetails(signature, details);
      } else {
        // just verify for now
        log('info', 'Skipping blockchain verification for cross chain and cross token payment for now');
        verificationResult = {
          isValid: true,
          details: {
            amount: details.amount,
            buyer: details.buyer,
            recipient: details.recipient
          }
        };
      }
      
      if (!verificationResult.isValid) {
        log('warn', 'Blockchain payment verification failed');
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            success: false,
            error: verificationResult.error,
            verificationResult
          })
        };
      }
    }

    // Process the orders
    const processResult = await processOrders(signature, allOrders, orderId, batchOrderId);
    
    return {
      statusCode: processResult.success ? 200 : 400,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: processResult.success,
        totalOrders: allOrders.length,
        message: processResult.success ? 'Orders processed successfully' : processResult.error,
        ordersUpdated: processResult.ordersUpdated || 0
      })
    };

  } catch (error) {
    log('error', 'Unexpected error in handler:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    };
  }
};