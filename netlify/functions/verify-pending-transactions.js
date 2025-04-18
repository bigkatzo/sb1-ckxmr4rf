/**
 * VERIFY PENDING TRANSACTIONS
 * 
 * This function verifies pending blockchain transactions in a batch process
 * It's designed to run on a schedule via Netlify's scheduled functions
 * or be triggered manually by an admin
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

// Check required environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HELIUS_API_KEY = process.env.VITE_HELIUS_API_KEY;
const ALCHEMY_API_KEY = process.env.VITE_ALCHEMY_API_KEY;

// Build RPC URL with proper API key
const getRpcUrl = () => {
  if (HELIUS_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  } else if (ALCHEMY_API_KEY) {
    return `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  } else {
    return 'https://api.mainnet-beta.solana.com'; // Public fallback
  }
};

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Missing required environment variables for Supabase:',
    !SUPABASE_URL ? 'VITE_SUPABASE_URL' : '',
    !SUPABASE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : ''
  );
}

// Initialize Supabase with fallback error handling
let supabase;
try {
  supabase = createClient(
    SUPABASE_URL || 'https://placeholder-url.supabase.co',
    SUPABASE_KEY || 'placeholder-key-for-initialization'
  );
} catch (err) {
  console.error('Failed to initialize Supabase client:', err.message);
  // We'll handle this in the handler function
}

let SOLANA_CONNECTION;
const LAMPORTS_PER_SOL = 1000000000;

// Initialize Solana connection if possible
try {
  if (Connection) {
    SOLANA_CONNECTION = new Connection(
      getRpcUrl(),
      'confirmed' // Use confirmed commitment level for faster verification
    );
    
    // Log the RPC endpoint being used (without exposing full API key)
    const rpcUrl = getRpcUrl();
    console.log(`Using Solana RPC: ${rpcUrl.substring(0, rpcUrl.indexOf('?') > 0 ? rpcUrl.indexOf('?') : rpcUrl.length)}`);
  }
} catch (err) {
  console.error('Failed to initialize Solana connection:', err.message);
  // We'll handle this later in the code
}

// Securely verify transaction details against the blockchain
async function verifyTransactionDetails(signature) {
  try {
    // Check if we have Solana libraries available
    if (!SOLANA_CONNECTION) {
      return { 
        isValid: false, 
        error: 'Solana verification is not available. Please try again later.' 
      };
    }

    const tx = await SOLANA_CONNECTION.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'finalized'
    });

    if (!tx || !tx.meta || tx.meta.err) {
      return { 
        isValid: false, 
        error: tx?.meta?.err 
          ? typeof tx.meta.err === 'string' 
            ? `Transaction failed: ${tx.meta.err}`
            : 'Transaction failed with an error'
          : 'Transaction not found' 
      };
    }

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

    return { isValid: true, details };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Failed to verify transaction' 
    };
  }
}

// Process a batch of pending transactions
async function processPendingTransactions(limit = 20) {
  try {
    // Check if Solana verification is available
    if (!SOLANA_CONNECTION) {
      console.log('Solana verification unavailable, skipping pending transaction check');
      return {
        success: false,
        error: 'Solana verification unavailable',
        message: 'Scheduled verification skipped - Solana libraries not available'
      };
    }

    // Get pending payment orders with Solana transactions
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, transaction_signature, amount_sol, wallet_address, payment_method, created_at')
      .eq('status', 'pending_payment')
      .not('transaction_signature', 'is', null)
      .not('transaction_signature', 'like', 'pi_%')  // Exclude Stripe
      .not('transaction_signature', 'like', 'free_%') // Exclude free orders
      .order('created_at', { ascending: false })
      .limit(limit);

    if (ordersError) {
      console.error('Error fetching pending orders:', ordersError);
      return {
        success: false,
        error: 'Failed to fetch pending orders'
      };
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      return {
        success: true,
        message: 'No pending Solana transactions found',
        processed: 0
      };
    }

    console.log(`Processing ${pendingOrders.length} pending transactions...`);
    
    const results = [];
    
    // Process each order
    for (const order of pendingOrders) {
      try {
        // Skip invalid transactions
        if (!order.transaction_signature || 
            order.transaction_signature === 'rejected' ||
            order.transaction_signature.length < 10) {
          continue;
        }
        
        console.log(`Verifying transaction ${order.transaction_signature} for order ${order.id}...`);
        
        // Verify transaction on chain
        const verification = await verifyTransactionDetails(order.transaction_signature);
        
        // Record the result
        const result = {
          orderId: order.id,
          signature: order.transaction_signature,
          isValid: verification.isValid,
          details: verification.details,
          error: verification.error
        };
        
        if (verification.isValid) {
          // If valid, compare expected values
          const expectedAmount = order.amount_sol;
          const buyerAddress = order.wallet_address;
          
          let isAmountValid = true;
          let isBuyerValid = true;
          
          if (expectedAmount && verification.details) {
            isAmountValid = Math.abs(verification.details.amount - expectedAmount) <= 0.00001;
            result.amountValid = isAmountValid;
            
            if (!isAmountValid) {
              result.amountError = `Amount mismatch: expected ${expectedAmount} SOL, got ${verification.details.amount} SOL`;
            }
          }
          
          if (buyerAddress && verification.details) {
            isBuyerValid = buyerAddress.toLowerCase() === verification.details.buyer.toLowerCase();
            result.buyerValid = isBuyerValid;
            
            if (!isBuyerValid) {
              result.buyerError = `Buyer mismatch: expected ${buyerAddress}, got ${verification.details.buyer}`;
            }
          }
          
          // Only confirm if everything is valid
          if (isAmountValid && isBuyerValid) {
            // Update transaction log with success
            const { error: updateError } = await supabase.rpc('update_transaction_status', {
              p_signature: order.transaction_signature,
              p_status: 'confirmed',
              p_details: {
                ...verification.details,
                confirmedAt: new Date().toISOString()
              }
            });
            
            if (updateError) {
              console.error('Failed to update transaction status:', updateError);
              result.statusUpdateError = updateError.message;
            }
            
            // Update order status
            const { error: confirmError } = await supabase.rpc('confirm_order_payment', {
              p_transaction_signature: order.transaction_signature,
              p_status: 'confirmed'
            });
            
            if (confirmError) {
              console.error('Failed to confirm order payment:', confirmError);
              result.orderUpdateError = confirmError.message;
            } else {
              result.orderConfirmed = true;
            }
          } else {
            // Record verification failure
            const { error: logError } = await supabase.rpc('update_transaction_status', {
              p_signature: order.transaction_signature,
              p_status: 'failed',
              p_details: {
                error: result.amountError || result.buyerError,
                verification: verification.details || null
              }
            });
            
            if (logError) {
              console.error('Failed to log verification failure:', logError);
              result.logError = logError.message;
            }
          }
        } else {
          // Record verification failure
          const { error: logError } = await supabase.rpc('update_transaction_status', {
            p_signature: order.transaction_signature,
            p_status: 'failed',
            p_details: {
              error: verification.error,
              verification: verification.details || null
            }
          });
          
          if (logError) {
            console.error('Failed to log verification failure:', logError);
            result.logError = logError.message;
          }
        }
        
        results.push(result);
      } catch (error) {
        console.error(`Error processing order ${order.id}:`, error);
        results.push({
          orderId: order.id,
          signature: order.transaction_signature,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return {
      success: true,
      processed: results.length,
      results
    };
  } catch (error) {
    console.error('Error processing pending transactions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

exports.handler = async (event, context) => {
  // Check if Supabase client is available
  if (!supabase) {
    console.error('Supabase client is not initialized');
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: false,
        message: 'Scheduled verification skipped - Database connection unavailable'
      })
    };
  }

  // Check if Solana is available
  if (!SOLANA_CONNECTION) {
    console.log('Solana connection is not available for scheduled function');
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: false,
        message: 'Scheduled verification skipped - Solana libraries not available'
      })
    };
  }

  // For scheduled functions, the event will be different
  const isScheduled = event.headers === undefined;
  
  if (!isScheduled && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // If manually triggered, validate authorization
  if (!isScheduled) {
    const authHeader = event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    
    // Check if token matches admin API key (if set)
    // But don't fail if no admin key is set (development mode)
    if (process.env.ADMIN_API_KEY && token !== process.env.ADMIN_API_KEY) {
      console.warn('Invalid API key for manual verification');
      // Allow with warning for now (development mode)
    } else if (token.length > 0) {
      console.log('Authorized admin verification request');
    } else {
      console.warn('No authorization token provided for manual verification');
    }
    
    // Allow the request to proceed for development purposes
    // In production, you might want to enforce this more strictly
  }

  try {
    // Parse parameters for manual runs
    let limit = 20;
    if (!isScheduled && event.body) {
      try {
        const body = JSON.parse(event.body);
        if (body.limit && typeof body.limit === 'number') {
          limit = Math.min(Math.max(1, body.limit), 100); // Limit between 1-100
        }
      } catch (err) {
        console.warn('Failed to parse request body, using default limit');
      }
    }

    const result = await processPendingTransactions(limit);
    
    return {
      statusCode: result.success ? 200 : 500,
      body: JSON.stringify(result)
    };
  } catch (err) {
    console.error('Error in verify pending transactions function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: err.message 
      })
    };
  }
}; 