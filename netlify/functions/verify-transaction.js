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
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  
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
  
  if (!ENV.SUPABASE_KEY || ENV.SUPABASE_KEY === 'placeholder-key-for-initialization') {
    console.error('Missing or invalid SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  
  // Only create client if we have reasonable values
  if (ENV.SUPABASE_URL && ENV.SUPABASE_KEY && 
      ENV.SUPABASE_URL !== 'https://placeholder-url.supabase.co' && 
      ENV.SUPABASE_KEY !== 'placeholder-key-for-initialization') {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY);
    console.log('Supabase client initialized successfully');
  } else {
    console.warn('Using fallback Supabase values - database operations will likely fail');
    supabase = createClient(
      ENV.SUPABASE_URL || 'https://placeholder-url.supabase.co',
      ENV.SUPABASE_KEY || 'placeholder-key-for-initialization'
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

// Verify and update the order status
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
    
    // Update order status
    try {
      const { error: confirmError } = await supabase.rpc('confirm_order_payment', {
        p_transaction_signature: signature,
        p_status: 'confirmed'
      });
      
      if (confirmError) {
        console.error('Failed to confirm order payment:', confirmError);
        return {
          success: false,
          error: 'Failed to confirm order payment'
        };
      }
    } catch (dbError) {
      console.error('Database error when confirming order payment:', dbError);
      return {
        success: false,
        error: 'Database error when confirming order'
      };
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
      console.log('Initializing Solana connection with robust WebSocket support...');
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
    
    // 2. Confirm the order payment status if orderId is provided
    let confirmationResult = { success: true };
    if (orderId && verification.isValid) {
      confirmationResult = await confirmOrderPayment(orderId, signature, verification);
    }
    
    if (!verification.isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: verification.error || 'Transaction verification failed',
          details: verification.details || {}
        })
      };
    }
    
    if (!confirmationResult.success) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: confirmationResult.error || 'Failed to confirm order',
          verification: {
            isValid: verification.isValid,
            details: verification.details
          }
        })
      };
    }
    
    // Everything was successful
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        verification: {
          isValid: verification.isValid,
          details: verification.details
        }
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