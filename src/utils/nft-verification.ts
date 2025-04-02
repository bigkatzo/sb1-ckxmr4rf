import { PublicKey } from '@solana/web3.js';
import { 
  Metaplex, 
  Nft, 
  Metadata, 
  MetaplexError,
  isNft
} from '@metaplex-foundation/js';
import { SOLANA_CONNECTION } from '../config/solana';

export interface NFTVerificationResult {
  isValid: boolean;
  error?: string;
  balance?: number;
}

interface CacheEntry {
  result: NFTVerificationResult;
  timestamp: number;
}

// Initialize Metaplex with proper configuration
const metaplex = Metaplex.make(SOLANA_CONNECTION);

// Configuration for NFT verification
const CONFIG = {
  BATCH_SIZE: 10, // Number of NFTs to load in parallel
  ENABLE_DEBUG_LOGS: process.env.NODE_ENV !== 'production',
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000, // Base delay in ms for exponential backoff
  CACHE_TTL: 5 * 60 * 1000, // Cache TTL in ms (5 minutes)
  PARALLEL_BATCH_PROCESSING: true, // Enable/disable parallel batch processing
};

// Simple in-memory cache
const verificationCache = new Map<string, CacheEntry>();

/**
 * Splits an array into chunks of specified size
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}

/**
 * Debug logging wrapper that only logs in non-production environments
 */
function debugLog(message: string, data?: any): void {
  if (CONFIG.ENABLE_DEBUG_LOGS) {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
}

/**
 * Generates a cache key for a verification request
 */
function getCacheKey(walletAddress: string, collectionAddress: string, minAmount: number): string {
  return `${walletAddress}:${collectionAddress}:${minAmount}`;
}

/**
 * Checks if metadata is valid and contains required properties
 */
function isValidMetadata(metadata: any): metadata is Metadata {
  return (
    metadata &&
    'mintAddress' in metadata &&
    metadata.mintAddress instanceof PublicKey &&
    'updateAuthority' in metadata &&
    metadata.updateAuthority instanceof PublicKey
  );
}

/**
 * Process a chunk of metadata entries and return valid NFTs
 */
async function processMetadataChunk(
  chunk: Metadata[],
  chunkIndex: number,
  totalChunks: number
): Promise<Nft[]> {
  debugLog(`Loading NFT batch ${chunkIndex + 1}/${totalChunks}...`);
  
  const loadedNfts = await Promise.all(
    chunk.map(async (metadata) => {
      try {
        const nft = await metaplex.nfts().load({ metadata });
        // Additional validation to ensure we have a valid NFT
        if (isNft(nft)) {
          return nft;
        }
        console.warn(`Loaded token is not a valid NFT: ${metadata.mintAddress.toString()}`);
        return null;
      } catch (error) {
        console.warn(
          `Failed to load NFT data for metadata: ${metadata.mintAddress.toString()}`,
          error instanceof Error ? error.message : 'Unknown error'
        );
        return null;
      }
    })
  );

  // Filter out failed loads and non-NFT tokens
  return loadedNfts.filter((nft): nft is Nft => nft !== null);
}

/**
 * Verifies if a wallet holds the required number of NFTs from a specific collection
 */
export async function verifyNFTHolding(
  walletAddress: string,
  collectionAddress: string,
  minAmount: number = 1
): Promise<NFTVerificationResult> {
  try {
    // Check cache first
    const cacheKey = getCacheKey(walletAddress, collectionAddress, minAmount);
    const cachedResult = verificationCache.get(cacheKey);
    
    if (cachedResult && (Date.now() - cachedResult.timestamp) < CONFIG.CACHE_TTL) {
      debugLog('Returning cached result for:', { walletAddress, collectionAddress });
      return cachedResult.result;
    }

    // Input validation
    if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
      return {
        isValid: false,
        error: 'Invalid wallet address format',
        balance: 0
      };
    }

    if (!collectionAddress || !isValidSolanaAddress(collectionAddress)) {
      return {
        isValid: false,
        error: 'Invalid collection address format',
        balance: 0
      };
    }

    const walletPubKey = new PublicKey(walletAddress);
    const collectionPubKey = new PublicKey(collectionAddress);

    debugLog('Starting NFT verification for:', {
      wallet: walletAddress,
      collection: collectionAddress
    });

    // First verify the collection exists and load its data
    let collectionNft;
    try {
      collectionNft = await metaplex.nfts().findByMint({ mintAddress: collectionPubKey });
      debugLog('Collection NFT found:', {
        name: collectionNft.name,
        address: collectionNft.address.toString(),
        verified: collectionNft.collection?.verified
      });
    } catch (error) {
      console.error('Error fetching collection:', error);
      if (error instanceof MetaplexError) {
        return {
          isValid: false,
          error: 'Invalid collection address or collection not found',
          balance: 0
        };
      }
      throw new Error(`Failed to fetch collection data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Fetch all NFTs owned by the user with retries
    let allMetadata: Metadata[] = [];
    let retryCount = 0;

    while (retryCount < CONFIG.MAX_RETRIES) {
      try {
        debugLog('Fetching NFTs...');
        const nfts = await metaplex.nfts().findAllByOwner({ owner: walletPubKey });
        
        // Improved metadata filtering with type checking
        allMetadata = nfts.filter(isValidMetadata);
        break;
      } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error);
        retryCount++;
        if (retryCount === CONFIG.MAX_RETRIES) {
          throw new Error(`Failed to fetch NFTs after ${CONFIG.MAX_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        // Wait before retrying with exponential backoff and jitter
        const delay = CONFIG.RETRY_DELAY_BASE * Math.pow(2, retryCount) * (0.5 + Math.random());
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    debugLog('Found total NFT metadata entries:', allMetadata.length);

    // Split metadata into chunks for batch processing
    const metadataChunks = chunkArray(allMetadata, CONFIG.BATCH_SIZE);
    const allTokens: Nft[] = [];

    if (CONFIG.PARALLEL_BATCH_PROCESSING) {
      // Process all chunks in parallel
      const chunksResults = await Promise.all(
        metadataChunks.map(async (chunk, chunkIndex) => {
          debugLog(`Processing chunk ${chunkIndex + 1}/${metadataChunks.length} in parallel`);
          return await processMetadataChunk(chunk, chunkIndex, metadataChunks.length);
        })
      );
      allTokens.push(...chunksResults.flat());
    } else {
      // Process chunks sequentially
      for (const [chunkIndex, chunk] of metadataChunks.entries()) {
        const chunkTokens = await processMetadataChunk(chunk, chunkIndex, metadataChunks.length);
        allTokens.push(...chunkTokens);
      }
    }

    debugLog('Successfully loaded NFTs:', allTokens.length);

    // Filter tokens that belong to the desired collection and are verified
    const matchingNFTs = allTokens.filter((nft) => {
      const collectionMatches = nft.collection?.address.equals(collectionPubKey);
      const isVerified = nft.collection?.verified === true;
      
      if (CONFIG.ENABLE_DEBUG_LOGS) {
        debugLog('Checking NFT:', {
          mint: nft.address.toString(),
          collectionMatches,
          isVerified
        });
      }
      
      return collectionMatches && isVerified;
    });

    const nftCount = matchingNFTs.length;
    const result: NFTVerificationResult = {
      isValid: nftCount >= minAmount,
      balance: nftCount,
      error: nftCount >= minAmount ? undefined : 
             `You need ${minAmount} NFT(s) from this collection, but only have ${nftCount}`
    };

    // Cache the result
    verificationCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Log verification details
    debugLog('NFT Verification Result:', {
      walletAddress,
      collectionAddress,
      totalNFTs: allTokens.length,
      matchingNFTs: nftCount,
      matchingDetails: CONFIG.ENABLE_DEBUG_LOGS ? matchingNFTs.map(nft => ({
        mint: nft.address.toString(),
        name: nft.name,
        collection: nft.collection?.address.toString(),
        verified: nft.collection?.verified
      })) : 'Debug logging disabled'
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to verify NFT balance';
    console.error('Error verifying NFT balance:', errorMessage);
    return {
      isValid: false,
      error: errorMessage,
      balance: 0
    };
  }
}

// Helper function to validate Solana address format
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
} 