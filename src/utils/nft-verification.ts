import { PublicKey } from '@solana/web3.js';
import { SOLANA_CONNECTION } from '../config/solana';
import { Metaplex } from '@metaplex-foundation/js';

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  resetTime: number;
}

// Initialize circuit breaker (closed by default)
const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
  resetTime: 0
};

// Circuit breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = 5; // Open after 5 failures
const CIRCUIT_BREAKER_RESET_TIMEOUT = 60000; // 1 minute timeout before retry

// Function to check and update circuit breaker
function checkCircuitBreaker(): boolean {
  const now = Date.now();
  
  // Check if it's time to try resetting the circuit breaker
  if (circuitBreaker.isOpen && now > circuitBreaker.resetTime) {
    console.log('Circuit breaker reset time reached, attempting to close');
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
    return false; // Allow the operation to proceed
  }
  
  // If circuit is open, block the operation
  return circuitBreaker.isOpen;
}

// Function to record a failure
function recordFailure(error: any): void {
  const now = Date.now();
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = now;
  
  // Log details about the error to help debugging
  console.error('API failure recorded:', {
    failureCount: circuitBreaker.failures,
    errorType: error?.constructor?.name || typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    errorStack: error instanceof Error ? error.stack : 'No stack trace'
  });
  
  // Check if we should open the circuit breaker
  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    console.warn(`Circuit breaker opened after ${circuitBreaker.failures} failures`);
    circuitBreaker.isOpen = true;
    circuitBreaker.resetTime = now + CIRCUIT_BREAKER_RESET_TIMEOUT;
    console.log(`Circuit will attempt to reset at ${new Date(circuitBreaker.resetTime).toISOString()}`);
  }
}

// Function to record a success
function recordSuccess(): void {
  // On success, reduce the failure count (but don't go below 0)
  circuitBreaker.failures = Math.max(0, circuitBreaker.failures - 1);
  
  // If we've had a success after partial failures, log it
  if (circuitBreaker.failures > 0) {
    console.log(`API call succeeded. Reducing failure count to ${circuitBreaker.failures}`);
  }
}

export interface NFTVerificationResult {
  isValid: boolean;
  error?: string;
  balance?: number;
}

// Cache NFT data with expiration
interface NFTCacheEntry {
  timestamp: number;
  nfts: any[];
}

// Cache NFT results for 10 minutes (in milliseconds)
const CACHE_EXPIRY = 10 * 60 * 1000;
const nftCache: Record<string, NFTCacheEntry> = {};

// Helper function to add delay between retries
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to add timeout to any promise
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
    
    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
};

// Function with retry mechanism - more conservative to save RPC calls
async function retryOperation<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3, // Increased from 2 to 3 retries
  delayMs: number = 3000  // Increased initial delay to 3 seconds
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff with random jitter to prevent thundering herd
        const jitter = Math.random() * 2000; // Add up to 2s of random jitter
        const backoffDelay = delayMs * Math.pow(1.5, attempt - 1) + jitter; 
        console.log(`Retrying in ${Math.round(backoffDelay)}ms...`);
        await sleep(backoffDelay);
      }
    }
  }
  
  console.error('All retry attempts failed:', lastError);
  throw lastError || new Error('Operation failed after retries');
}

export async function verifyNFTHolding(
  walletAddress: string,
  collectionAddress: string,
  minAmount: number = 1
): Promise<NFTVerificationResult> {
  try {
    // Basic input validation
    if (!walletAddress || !collectionAddress || minAmount <= 0) {
      return { isValid: false, error: 'Invalid input parameters', balance: 0 };
    }

    // Clean up the collection address (trim whitespace)
    const cleanCollectionAddress = collectionAddress.trim();
    
    console.log('Verifying NFT holding for wallet:', walletAddress);
    console.log('Collection address:', cleanCollectionAddress);
    console.log('Min amount required:', minAmount);

    // Check cache first before making RPC calls
    const cacheKey = `${walletAddress}-nfts`;
    const now = Date.now();
    const cachedData = nftCache[cacheKey];
    
    let nfts: any[];
    
    // Only use cache for successful responses and if not expired
    if (cachedData && now - cachedData.timestamp < CACHE_EXPIRY) {
      console.log('Using cached NFT data');
      nfts = cachedData.nfts;
    } else {
      try {
        // No valid cache, fetch fresh data with error handling
        nfts = await fetchNFTs(walletAddress);
      } catch (fetchError) {
        console.error('Error fetching NFTs:', fetchError);
        // Return a helpful error message rather than failing silently
        return {
          isValid: false,
          error: fetchError instanceof Error 
            ? `Unable to verify NFT ownership: ${fetchError.message}`
            : 'Unable to verify NFT ownership due to API connection issues',
          balance: 0
        };
      }
    }
    
    console.log(`Found ${nfts.length} total NFTs in wallet`);
    
    // Debug each NFT's model type
    console.log('NFT models:', nfts.map(nft => nft.model));
    
    // Log only a subset of NFTs to reduce log size (only if there are many)
    if (nfts.length > 20) {
      console.log(`Showing first 5 of ${nfts.length} NFTs:`);
      nfts.slice(0, 5).forEach((nft, i) => {
        console.log(`NFT #${i+1}:`, {
          model: nft.model,
          name: nft.name,
          mint: nft.address.toBase58(),
          hasCollection: !!nft.collection,
          collection: nft.collection ? nft.collection.address.toBase58() : 'No collection',
          verified: nft.collection ? nft.collection.verified : false
        });
      });
    } else {
      // Log all NFTs if there aren't too many
      nfts.forEach((nft, i) => {
        console.log(`NFT #${i+1}:`, {
          model: nft.model,
          name: nft.name,
          mint: nft.address.toBase58(),
          hasCollection: !!nft.collection,
          collection: nft.collection ? nft.collection.address.toBase58() : 'No collection',
          verified: nft.collection ? nft.collection.verified : false
        });
      });
    }
    
    // Filter NFTs by collection
    // Accept both 'nft' and 'metadata' models since Metaplex might return either
    const collectionNfts = nfts.filter((nft) => {
      // Check if this is an NFT-like object (either 'nft' or 'metadata' model)
      if (!nft || (nft.model !== 'nft' && nft.model !== 'metadata')) {
        return false;
      }
      
      const collection = nft.collection;
      if (!collection) {
        return false;
      }
      
      // Check if this NFT belongs to the target collection
      const nftCollectionAddress = collection.address.toBase58();
      const isFromCollection = nftCollectionAddress === cleanCollectionAddress;
      
      // Only log matches to reduce verbosity
      if (isFromCollection) {
        console.log(`Found matching NFT ${nft.address.toBase58()}:`, {
          name: nft.name,
          collection: nftCollectionAddress,
          verified: collection.verified
        });
      }
      
      // Only check collection match, not verification status
      return isFromCollection;
    });

    const nftCount = collectionNfts.length;
    console.log('NFT verification final result:', {
      collection: cleanCollectionAddress,
      found: nftCount,
      required: minAmount,
      nfts: collectionNfts.map(nft => nft.address.toBase58()).slice(0, 5) // Only log first 5 for brevity
    });

    return {
      isValid: nftCount >= minAmount,
      balance: nftCount,
      error: nftCount >= minAmount ? undefined : 
             `You need ${minAmount} NFT(s) from this collection, but only have ${nftCount}`
    };

  } catch (error) {
    console.error('Error verifying NFT balance:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to verify NFT balance',
      balance: 0
    };
  }
}

// Helper function to fetch NFTs with proper error handling and caching
async function fetchNFTs(walletAddress: string): Promise<any[]> {
  const cacheKey = `${walletAddress}-nfts`;
  const now = Date.now();
  
  // Check circuit breaker first
  if (checkCircuitBreaker()) {
    const nextRetryTime = new Date(circuitBreaker.resetTime).toLocaleTimeString();
    throw new Error(`Too many API failures, temporarily pausing requests until ${nextRetryTime}`);
  }
  
  try {
    const connection = SOLANA_CONNECTION;
    const metaplex = Metaplex.make(connection);
    const walletPublicKey = new PublicKey(walletAddress);
    
    // Only use the retry mechanism when we actually need to make the API call
    console.log('Fetching all NFTs for wallet...');
    
    // For empty results, only retry if we get 0 NFTs (which is likely an API issue)
    const nfts = await retryOperation(
      async () => {
        console.log('Making API call to Metaplex...');
        try {
          // Add a 15 second timeout to prevent hanging connections
          const results = await withTimeout(
            metaplex.nfts().findAllByOwner({ owner: walletPublicKey }),
            15000, // 15 second timeout
            'API call to Metaplex timed out after 15 seconds'
          );
          
          console.log(`API call succeeded, found ${results.length} NFTs`);
          
          // Only trigger a retry if we get 0 NFTs (likely an API failure)
          if (results.length === 0) {
            throw new Error('Received 0 NFTs from API, likely a temporary issue');
          }
          
          // Record the success in our circuit breaker
          recordSuccess();
          
          return results;
        } catch (error) {
          // Add more detailed error logging
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Metaplex API call failed:', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : 'No stack trace',
            walletAddress: walletPublicKey.toBase58()
          });
          
          throw error;
        }
      },
      3,  // Max 3 retries
      3000  // Start with 3 second delay
    );
    
    // Only cache successful results
    nftCache[cacheKey] = {
      timestamp: now,
      nfts
    };
    
    return nfts;
  } catch (error) {
    // Record the failure in our circuit breaker
    recordFailure(error);
    
    // Don't cache failures - just log and propagate the error
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`NFT fetch failed for ${walletAddress}: ${errorMessage}`);
    throw error; // Re-throw to allow the caller to handle the error
  }
}