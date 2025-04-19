/**
 * Shared RPC service for Solana
 * This module centralizes RPC connection handling for both frontend and serverless functions
 * Implementation is designed to exactly match the frontend logic in src/config/solana.ts
 */

const { Connection, PublicKey } = require('@solana/web3.js');

/**
 * Creates configuration for RPC endpoints based on available API keys
 * @param {Object} env - Environment variables containing API keys
 * @returns {Object} RPC endpoints configuration
 */
function createRpcConfig(env) {
  const HELIUS_API_KEY = env.HELIUS_API_KEY || env.VITE_HELIUS_API_KEY || '';
  const ALCHEMY_API_KEY = env.ALCHEMY_API_KEY || env.VITE_ALCHEMY_API_KEY || '';
  
  // Match exactly the frontend endpoint configuration
  const RPC_ENDPOINTS = {
    primary: HELIUS_API_KEY 
      ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com',
    fallbacks: [
      ALCHEMY_API_KEY 
        ? `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : 'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://rpc.ankr.com/solana',
      'https://solana.public-rpc.com'
    ]
  };
  
  // Match the exact frontend CONNECTION_CONFIG configuration
  const CONNECTION_CONFIG = {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
    disableRetryOnRateLimit: false,
    wsEndpoint: HELIUS_API_KEY 
      ? `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
      : ALCHEMY_API_KEY 
        ? `wss://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : undefined,
    httpHeaders: {
      'x-api-key': HELIUS_API_KEY || ALCHEMY_API_KEY || '',
    }
  };
  
  return { 
    RPC_ENDPOINTS, 
    CONNECTION_CONFIG,
    // Masked keys for logging
    maskedKeys: {
      helius: HELIUS_API_KEY ? maskApiKey(HELIUS_API_KEY) : null,
      alchemy: ALCHEMY_API_KEY ? maskApiKey(ALCHEMY_API_KEY) : null
    }
  };
}

/**
 * Masks API key for safe logging
 * @param {string} key - API key to mask
 * @returns {string} Masked API key (first 4 and last 4 chars visible)
 */
function maskApiKey(key) {
  if (!key || key.length < 8) return null;
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

/**
 * Creates a connection with retry logic - directly matching frontend implementation
 * @param {Object} env - Environment variables
 * @returns {Promise<Connection>} Solana connection
 */
async function createConnectionWithRetry(env) {
  const config = createRpcConfig(env);
  let lastError = null;
  
  // Log environment info
  if (config.maskedKeys.helius) {
    console.log(`Using Helius RPC with key: ${config.maskedKeys.helius}`);
  } else if (config.maskedKeys.alchemy) {
    console.log(`Using Alchemy RPC with key: ${config.maskedKeys.alchemy}`);
  } else {
    console.warn('No API keys found. Using public RPC endpoint with rate limits.');
  }

  // Try primary endpoint first - EXACT SAME LOGIC AS FRONTEND
  try {
    const connection = new Connection(config.RPC_ENDPOINTS.primary, config.CONNECTION_CONFIG);
    await connection.getVersion();
    console.log('✅ Connected to primary RPC endpoint');
    return connection;
  } catch (error) {
    console.warn('Primary RPC endpoint failed, trying fallbacks...', error);
    lastError = error instanceof Error ? error : new Error('Unknown error');
  }

  // Try fallback endpoints with exponential backoff - EXACT SAME LOGIC AS FRONTEND
  for (let i = 0; i < config.RPC_ENDPOINTS.fallbacks.length; i++) {
    const endpoint = config.RPC_ENDPOINTS.fallbacks[i];
    try {
      // Add exponential backoff with jitter
      const backoff = Math.min(1000 * Math.pow(2, i), 10000);
      const jitter = Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, backoff + jitter));
      
      const connection = new Connection(endpoint, {
        ...config.CONNECTION_CONFIG,
        wsEndpoint: undefined // Don't use WebSocket for fallbacks - same as frontend
      });
      
      await connection.getVersion();
      console.log(`✅ Connected to fallback RPC endpoint: ${endpoint}`);
      return connection;
    } catch (error) {
      console.warn(`Fallback endpoint ${endpoint} failed:`, error);
      lastError = error instanceof Error ? error : new Error('Unknown error');
    }
  }

  // If all endpoints failed, log the last error and create a connection to primary anyway
  // It might work later and the app can handle connection errors gracefully
  console.warn('⚠️ All RPC endpoints failed, using primary endpoint. Last error:', lastError?.message);
  return new Connection(config.RPC_ENDPOINTS.primary, config.CONNECTION_CONFIG);
}

/**
 * Verifies a transaction with proper error handling and timeouts
 * @param {Connection} connection - Solana connection
 * @param {string} signature - Transaction signature
 * @returns {Promise<Object>} Transaction details or error
 */
async function verifyTransaction(connection, signature) {
  try {
    if (!connection) {
      return { 
        isValid: false, 
        error: 'Solana connection is not available' 
      };
    }
    
    let tx;
    try {
      // Use a timeout to prevent hanging requests
      const fetchPromise = connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'finalized'
      });
      
      // Apply timeout to avoid hanging function - same timeout as frontend network-test.ts
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('RPC request timed out')), 5000)
      );
      
      tx = await Promise.race([fetchPromise, timeoutPromise]);
    } catch (rpcError) {
      console.error('RPC error details:', {
        message: rpcError.message,
        name: rpcError.name,
        code: rpcError.code
      });
      
      // Handle specific RPC errors
      if (rpcError.message && (
          rpcError.message.includes('Unauthorized') || 
          rpcError.message.includes('authentication') ||
          rpcError.message.includes('API key')
      )) {
        return {
          isValid: false,
          error: 'RPC authentication failed. Please try again later or contact support.'
        };
      }
      
      if (rpcError.message && rpcError.message.includes('timed out')) {
        return {
          isValid: false,
          error: 'RPC request timed out. Please try again later.'
        };
      }
      
      return {
        isValid: false,
        error: `RPC error: ${rpcError.message}`
      };
    }
    
    if (!tx || !tx.meta) {
      return { 
        isValid: false, 
        error: 'Transaction not found or invalid'
      };
    }
    
    if (tx.meta.err) {
      return { 
        isValid: false, 
        error: typeof tx.meta.err === 'string' 
          ? `Transaction failed: ${tx.meta.err}`
          : 'Transaction failed with an error'
      };
    }
    
    return { isValid: true, transaction: tx };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Failed to verify transaction' 
    };
  }
}

/**
 * Gets the latest blockhash with retry logic - matches frontend implementation
 * @param {Connection} connection - Solana connection
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delayMs - Base delay between attempts in ms
 * @returns {Promise<Object>} Blockhash and lastValidBlockHeight
 */
async function getLatestBlockhashWithRetry(connection, maxRetries = 3, delayMs = 1000) {
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Getting latest blockhash (attempt ${attempt + 1}/${maxRetries})`);
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({
        commitment: 'finalized'
      });

      if (!blockhash || !lastValidBlockHeight) {
        throw new Error('Invalid blockhash response');
      }

      console.log('Got valid blockhash:', {
        blockhash: blockhash.slice(0, 8) + '...',
        lastValidBlockHeight,
        attempt: attempt + 1
      });

      return { blockhash, lastValidBlockHeight };
    } catch (error) {
      console.error(`Blockhash fetch attempt ${attempt + 1} failed:`, error);
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt < maxRetries - 1) {
        const jitter = Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt) + jitter));
      }
    }
  }

  throw lastError || new Error('Failed to get latest blockhash after retries');
}

module.exports = {
  createConnectionWithRetry,
  verifyTransaction,
  maskApiKey,
  getLatestBlockhashWithRetry
}; 