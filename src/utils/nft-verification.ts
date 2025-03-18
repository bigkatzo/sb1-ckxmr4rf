import { PublicKey, Connection, ConnectionConfig } from '@solana/web3.js';
import type { Metadata, Nft, Sft } from '@metaplex-foundation/js';
import { SOLANA_CONNECTION } from '../config/solana';

export interface NFTVerificationResult {
  isValid: boolean;
  error?: string;
  balance?: number;
}

// Validate Solana address format
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// Chunk array into smaller arrays for rate limiting
function chunkArray<T>(array: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
    array.slice(i * size, i * size + size)
  );
}

export async function verifyNFTHolding(
  walletAddress: string,
  collectionAddress: string,
  minAmount: number,
  retryAttempts = 2
): Promise<NFTVerificationResult> {
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

  if (typeof minAmount !== 'number' || minAmount < 0) {
    return {
      isValid: false,
      error: 'Invalid minimum amount specified',
      balance: 0
    };
  }

  try {
    const walletPubKey = new PublicKey(walletAddress);
    const collectionPubKey = new PublicKey(collectionAddress);
    
    // Configure connection with timeouts and commitment
    const connectionConfig: ConnectionConfig = {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    };
    
    const connection = new Connection(
      SOLANA_CONNECTION.rpcEndpoint,
      connectionConfig
    );

    // Dynamically import only the required Metaplex functionality
    const { Metaplex } = await import('@metaplex-foundation/js');
    const metaplex = Metaplex.make(connection);

    // Retry logic for network issues
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      try {
        // Get all NFTs owned by the user (returns Metadata objects)
        const nfts = await metaplex.nfts().findAllByOwner({ owner: walletPubKey });

        // Filter NFTs that belong to the specified verified collection
        const matchingNFTs = nfts.filter((nft: Metadata | Nft | Sft) => {
          const collection = 'collection' in nft ? nft.collection : null;
          if (!collection) {
            return false;
          }

          // Check collection match and verification
          return (
            collection.verified === true &&
            collection.address.toBase58() === collectionPubKey.toBase58()
          );
        });

        // Process NFTs in chunks to avoid rate limits
        const CHUNK_SIZE = 5;
        const nftChunks = chunkArray(matchingNFTs, CHUNK_SIZE);
        const loadedNFTsArrays = await Promise.all(
          nftChunks.map(async (chunk) => {
            const chunkPromises = chunk.map(async (nft) => {
              try {
                // If it's already an Nft type, return it directly
                if ('model' in nft && nft.model === 'nft') {
                  return nft as Nft;
                }
                // Otherwise load the full NFT data
                return await metaplex.nfts().load({ metadata: nft as Metadata });
              } catch (error) {
                console.error('Error loading NFT data:', error);
                return null;
              }
            });
            
            // Add slight delay between chunks to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
            return Promise.all(chunkPromises);
          })
        );

        // Flatten chunks and filter out nulls
        const loadedNFTs = loadedNFTsArrays.flat();
        const validNFTs = loadedNFTs.filter((nft): nft is Nft => nft !== null);
        const nftCount = validNFTs.length;

        // Debug information with more details
        console.log('NFT Verification Debug:', {
          walletAddress: walletAddress,
          collectionAddress: collectionAddress,
          totalNFTs: nfts.length,
          matchingNFTs: nftCount,
          attemptNumber: attempt + 1,
          matchingNFTDetails: validNFTs.map((nft) => ({
            mint: nft.address.toBase58(),
            name: nft.name,
            symbol: nft.symbol,
            collection: nft.collection ? {
              address: nft.collection.address.toBase58(),
              verified: nft.collection.verified
            } : null,
            uri: nft.uri
          }))
        });

        return {
          isValid: nftCount >= minAmount,
          balance: nftCount,
          error: nftCount >= minAmount ? undefined : 
                 `You need ${minAmount} NFT(s) from this collection, but only have ${nftCount}`
        };
      } catch (error) {
        lastError = error as Error;
        console.error(`Attempt ${attempt + 1} failed:`, error);
        
        // If this isn't our last attempt, wait before retrying
        if (attempt < retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1))); // Exponential backoff
          continue;
        }
      }
    }

    // If we get here, all attempts failed
    throw lastError || new Error('All verification attempts failed');
  } catch (error) {
    console.error('Error verifying NFT balance:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to verify NFT balance',
      balance: 0
    };
  }
} 