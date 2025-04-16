import { Connection, Commitment } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;
export const HELIUS_API_KEY = import.meta.env.VITE_HELIUS_API_KEY;

// Primary RPC endpoint with fallbacks
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

// Metaplex-specific RPC configuration
// These endpoints tend to be better optimized for NFT metadata operations
const METAPLEX_RPC_ENDPOINTS = {
  primary: HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : ALCHEMY_API_KEY
      ? `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : 'https://api.mainnet-beta.solana.com',
  fallbacks: [
    // Quicknode has good NFT support if you have an API key
    process.env.QUICKNODE_API_KEY
      ? `https://withered-white-rain.solana-mainnet.quiknode.pro/${process.env.QUICKNODE_API_KEY}/`
      : null,
    // These are generally reliable for NFT operations
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana'
  ].filter(Boolean) as string[] // Filter out null values
};

// Enhanced configuration for Metaplex operations
const CONNECTION_CONFIG = {
  commitment: 'confirmed' as Commitment, // Changed from 'finalized' for faster NFT operations
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
  wsEndpoint: HELIUS_API_KEY 
    ? `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : ALCHEMY_API_KEY 
      ? `wss://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : undefined,
  // Add specific RPC configs for Metaplex
  httpHeaders: {
    'x-api-key': HELIUS_API_KEY || ALCHEMY_API_KEY || '',
  }
};

// Create connection with improved retry logic
async function createConnectionWithRetry(): Promise<Connection> {
  let lastError: Error | null = null;
  
  // Try primary endpoint first
  try {
    const connection = new Connection(RPC_ENDPOINTS.primary, CONNECTION_CONFIG);
    await connection.getVersion();
    console.log('✅ Connected to primary RPC endpoint');
    return connection;
  } catch (error) {
    console.warn('Primary RPC endpoint failed, trying fallbacks...', error);
    lastError = error instanceof Error ? error : new Error('Unknown error');
  }

  // Try fallback endpoints with exponential backoff
  for (let i = 0; i < RPC_ENDPOINTS.fallbacks.length; i++) {
    const endpoint = RPC_ENDPOINTS.fallbacks[i];
    try {
      // Add exponential backoff with jitter
      const backoff = Math.min(1000 * Math.pow(2, i), 10000);
      const jitter = Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, backoff + jitter));
      
      const connection = new Connection(endpoint, {
        ...CONNECTION_CONFIG,
        wsEndpoint: undefined // Don't use WebSocket for fallbacks
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
  return new Connection(RPC_ENDPOINTS.primary, CONNECTION_CONFIG);
}

// Export connection with retry logic
export const SOLANA_CONNECTION = await createConnectionWithRetry();

/**
 * Creates a Metaplex instance with fallback capabilities
 * This function will try multiple RPC endpoints if the primary one fails
 */
export async function createMetaplexWithFallback(): Promise<Metaplex> {
  // First try to create with the primary endpoint
  try {
    console.log('Initializing Metaplex with primary endpoint');
    const metaplex = Metaplex.make(SOLANA_CONNECTION);
    
    // Test the connection with a simple API call
    // This helps verify the RPC endpoint is working well with Metaplex
    await metaplex.rpc().getLatestBlockhash();
    console.log('✅ Metaplex initialized with primary endpoint');
    return metaplex;
  } catch (error) {
    console.warn('Failed to initialize Metaplex with primary endpoint:', error);
  }
  
  // Try fallback endpoints
  for (let i = 0; i < METAPLEX_RPC_ENDPOINTS.fallbacks.length; i++) {
    const endpoint = METAPLEX_RPC_ENDPOINTS.fallbacks[i];
    try {
      // Add exponential backoff with jitter
      const backoff = Math.min(1000 * Math.pow(2, i), 5000);
      const jitter = Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, backoff + jitter));
      
      console.log(`Trying Metaplex with fallback endpoint #${i+1}`);
      
      // Create new connection for this specific endpoint
      const fallbackConnection = new Connection(endpoint, CONNECTION_CONFIG);
      
      // Create and test Metaplex instance
      const metaplex = Metaplex.make(fallbackConnection);
      await metaplex.rpc().getLatestBlockhash();
      
      console.log(`✅ Metaplex successfully initialized with fallback endpoint #${i+1}`);
      return metaplex;
    } catch (error) {
      console.warn(`Fallback endpoint #${i+1} failed for Metaplex:`, error);
    }
  }
  
  // If all fallbacks fail, return one with the primary connection
  // The application can handle any subsequent failures
  console.warn('⚠️ All Metaplex fallbacks failed, using primary endpoint');
  return Metaplex.make(SOLANA_CONNECTION);
}

// Create and export a pre-initialized Metaplex instance
export const METAPLEX = await createMetaplexWithFallback();