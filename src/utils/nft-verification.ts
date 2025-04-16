import { PublicKey } from '@solana/web3.js';
import { SOLANA_CONNECTION } from '../config/solana';
import { Metaplex } from '@metaplex-foundation/js';

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

// Function with retry mechanism - more conservative to save RPC calls
async function retryOperation<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 2, // Reduced from 3 to 2 retries
  delayMs: number = 2000  // Increased initial delay to 2 seconds
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff: wait longer between successive retries
        const backoffDelay = delayMs * Math.pow(1.5, attempt - 1); // Reduced factor from 2 to 1.5
        console.log(`Retrying in ${backoffDelay}ms...`);
        await sleep(backoffDelay);
      }
    }
  }
  
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
    
    if (cachedData && (now - cachedData.timestamp < CACHE_EXPIRY)) {
      console.log('Using cached NFT data');
      nfts = cachedData.nfts;
    } else {
      const connection = SOLANA_CONNECTION;
      const metaplex = Metaplex.make(connection);
      const walletPublicKey = new PublicKey(walletAddress);
      
      // Only use the retry mechanism when we actually need to make the API call
      console.log('Fetching all NFTs for wallet...');
      
      // For empty results, only retry if we get 0 NFTs (which is likely an API issue)
      nfts = await retryOperation(
        async () => {
          const results = await metaplex.nfts().findAllByOwner({ owner: walletPublicKey });
          // Only trigger a retry if we get 0 NFTs (likely an API failure)
          if (results.length === 0) {
            throw new Error('Received 0 NFTs from API, likely a temporary issue');
          }
          return results;
        },
        2,  // Max 2 retries
        2000  // Start with 2 second delay
      );
      
      // Cache the results
      nftCache[cacheKey] = {
        timestamp: now,
        nfts
      };
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