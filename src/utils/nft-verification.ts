import { PublicKey, Connection, ConnectionConfig } from '@solana/web3.js';
import type { Metadata, Nft, Sft } from '@metaplex-foundation/js';
import { SOLANA_CONNECTION } from '../config/solana';

export interface NFTVerificationResult {
  isValid: boolean;
  error?: string;
  balance?: number;
}

// Singleton class for NFT verification with lazy loading
class NFTVerifier {
  private static instance: NFTVerifier;
  private connection: Connection;
  private metaplex: any | null = null; // Will be initialized lazily
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    const connectionConfig: ConnectionConfig = {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    };
    
    this.connection = new Connection(
      SOLANA_CONNECTION.rpcEndpoint,
      connectionConfig
    );
  }

  public static getInstance(): NFTVerifier {
    if (!NFTVerifier.instance) {
      NFTVerifier.instance = new NFTVerifier();
    }
    return NFTVerifier.instance;
  }

  public async initializeMetaplex() {
    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        try {
          const { Metaplex } = await import('@metaplex-foundation/js');
          this.metaplex = Metaplex.make(this.connection);
        } catch (error) {
          this.initializationPromise = null; // Reset promise on failure
          throw error;
        }
      })();
    }
    return this.initializationPromise;
  }

  // Validate Solana address format
  private isValidSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  // Chunk array into smaller arrays for rate limiting
  private chunkArray<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size)
    );
  }

  public async verifyNFTHolding(
    walletAddress: string,
    collectionAddress: string,
    minAmount: number,
    retryAttempts = 2
  ): Promise<NFTVerificationResult> {
    // Input validation
    if (!walletAddress || !this.isValidSolanaAddress(walletAddress)) {
      return {
        isValid: false,
        error: 'Invalid wallet address format',
        balance: 0
      };
    }

    if (!collectionAddress || !this.isValidSolanaAddress(collectionAddress)) {
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
      // Ensure Metaplex is initialized before proceeding
      await this.initializeMetaplex();
      
      const walletPubKey = new PublicKey(walletAddress);
      const collectionPubKey = new PublicKey(collectionAddress);

      // Retry logic for network issues
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= retryAttempts; attempt++) {
        try {
          // Get all NFTs owned by the user (returns Metadata objects)
          const nfts: (Metadata | Nft | Sft)[] = await this.metaplex.nfts().findAllByOwner({ owner: walletPubKey });

          // First: load all NFTs regardless of collection
          const CHUNK_SIZE = 5;
          const nftChunks = this.chunkArray(nfts, CHUNK_SIZE);
          const loadedNFTsArrays = await Promise.all(
            nftChunks.map(async (chunk) => {
              const chunkPromises = chunk.map(async (nft) => {
                try {
                  // Always load full NFT data to ensure collection info is available
                  return await this.metaplex.nfts().load({ metadata: nft as Metadata });
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

          // Then filter after full loading
          const loadedNFTs = loadedNFTsArrays.flat();
          const validNFTs = loadedNFTs.filter((nft): nft is Nft => nft !== null);

          // Now filter for collection membership with fully loaded NFT data
          const matchingNFTs = validNFTs.filter((nft) =>
            nft.collection?.address.toBase58() === collectionPubKey.toBase58()
          );

          const nftCount = matchingNFTs.length;

          // Debug information with more details
          console.log('NFT Verification Debug:', {
            walletAddress: walletAddress,
            collectionAddress: collectionAddress,
            totalNFTs: nfts.length,
            loadedNFTs: validNFTs.length,
            matchingNFTs: nftCount,
            attemptNumber: attempt + 1,
            matchingNFTDetails: matchingNFTs.map((nft) => ({
              mint: nft.address.toBase58(),
              name: nft.name,
              symbol: nft.symbol,
              collection: nft.collection ? {
                address: nft.collection.address.toBase58()
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
}

// Export the verification function that uses the singleton
export async function verifyNFTHolding(
  walletAddress: string,
  collectionAddress: string,
  minAmount: number
): Promise<NFTVerificationResult> {
  const verifier = NFTVerifier.getInstance();
  return verifier.verifyNFTHolding(walletAddress, collectionAddress, minAmount);
}

// Add preload function that can be called after initial app load
export function preloadNFTVerifier(): void {
  // Preload in the background without blocking
  setTimeout(() => {
    const verifier = NFTVerifier.getInstance();
    verifier.initializeMetaplex().catch(err => {
      // Silent fail on preload
      console.debug('NFT Verifier preload failed:', err);
    });
  }, 3000); // Wait 3 seconds after call to start preloading
}

// Add initialization function
export async function initializeNFTVerifier(): Promise<void> {
  try {
    await NFTVerifier.getInstance();
    console.log('NFT Verifier initialized successfully');
  } catch (error) {
    console.error('Failed to initialize NFT Verifier:', error);
    throw error;
  }
} 