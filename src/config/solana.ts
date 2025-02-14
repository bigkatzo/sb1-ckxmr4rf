import { Connection, Commitment } from '@solana/web3.js';

const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;

// Primary RPC endpoint with fallbacks
const RPC_ENDPOINTS = {
  primary: ALCHEMY_API_KEY 
    ? `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
    : 'https://api.mainnet-beta.solana.com',
  fallbacks: [
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana',
    'https://solana.public-rpc.com'
  ]
};

export const MERCHANT_WALLET = '811WxG7vYZtQwerbQFPT3QiSG11LkQDmMvFdA7Enwoxo';

const CONNECTION_CONFIG = {
  commitment: 'finalized' as Commitment,
  confirmTransactionInitialTimeout: 60000,
  disableRetryOnRateLimit: false,
  wsEndpoint: ALCHEMY_API_KEY 
    ? `wss://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
    : undefined
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

  // If all endpoints failed, create a connection to primary anyway
  // It might work later and the app can handle connection errors gracefully
  console.warn('⚠️ All RPC endpoints failed, using primary endpoint');
  return new Connection(RPC_ENDPOINTS.primary, CONNECTION_CONFIG);
}

// Export connection with retry logic
export const SOLANA_CONNECTION = await createConnectionWithRetry();