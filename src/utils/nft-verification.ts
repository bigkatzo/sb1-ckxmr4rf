import { PublicKey } from '@solana/web3.js';
import { 
  Metaplex, 
  Nft, 
  Metadata, 
  MetaplexError
} from '@metaplex-foundation/js';
import { SOLANA_CONNECTION } from '../config/solana';

export interface NFTVerificationResult {
  isValid: boolean;
  error?: string;
  balance?: number;
}

// Initialize Metaplex with proper configuration
const metaplex = Metaplex.make(SOLANA_CONNECTION);

// Configuration for NFT verification
const CONFIG = {
  BATCH_SIZE: 10, // Number of NFTs to load in parallel
  ENABLE_DEBUG_LOGS: process.env.NODE_ENV !== 'production',
  MAX_RETRIES: 3,
  RETRY_DELAY_BASE: 1000, // Base delay in ms for exponential backoff
};

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
function debugLog(message: string, data?: any) {
  if (CONFIG.ENABLE_DEBUG_LOGS) {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
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
    let metadataList: Metadata[] = [];
    let retryCount = 0;

    while (retryCount < CONFIG.MAX_RETRIES) {
      try {
        debugLog(`Attempt ${retryCount + 1} to fetch NFTs...`);
        const nfts = await metaplex.nfts().findAllByOwner({ owner: walletPubKey });
        metadataList = nfts.filter((nft): nft is Metadata => 'mintAddress' in nft);
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

    debugLog('Found total NFT metadata entries:', metadataList.length);

    // Load full NFT data in batches
    const allTokens: Nft[] = [];
    const metadataChunks = chunkArray(metadataList, CONFIG.BATCH_SIZE);

    for (const [chunkIndex, chunk] of metadataChunks.entries()) {
      debugLog(`Loading NFT batch ${chunkIndex + 1}/${metadataChunks.length}...`);
      
      const loadedNfts = await Promise.all(
        chunk.map(async (metadata) => {
          try {
            return await metaplex.nfts().load({ metadata });
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
      const validNfts = loadedNfts.filter((nft): nft is Nft => 
        nft !== null && 
        nft.model === 'nft'
      );
      allTokens.push(...validNfts);
    }

    debugLog('Successfully loaded NFTs:', allTokens.length);

    // Log NFT details in debug mode only
    if (CONFIG.ENABLE_DEBUG_LOGS) {
      allTokens.forEach((nft, index) => {
        debugLog(`NFT ${index + 1}:`, {
          mint: nft.address.toString(),
          name: nft.name,
          collection: nft.collection?.address.toString(),
          verified: nft.collection?.verified
        });
      });
    }

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

    return {
      isValid: nftCount >= minAmount,
      balance: nftCount,
      error: nftCount >= minAmount ? undefined : 
             `You need ${minAmount} NFT(s) from this collection, but only have ${nftCount}`
    };
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