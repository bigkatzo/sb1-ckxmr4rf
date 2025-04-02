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
  private metaplex: any | null = null;
  private initializationPromise: Promise<void> | null = null;
  
  // More balanced RPC rate limiting
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 100; // 100ms between requests (10 RPS max)
  private readonly MAX_CONCURRENT_REQUESTS = 4; // Allow up to 4 concurrent requests
  private activeRequests = 0;

  private constructor() {
    const connectionConfig: ConnectionConfig = {
      commitment: 'finalized',
      confirmTransactionInitialTimeout: 120000,
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
          console.error('Failed to initialize Metaplex:', error);
          throw new Error('Failed to initialize Metaplex client');
        }
      })();
    }
    return this.initializationPromise;
  }

  // Add method to check if Metaplex is ready
  private async ensureMetaplexReady(): Promise<void> {
    if (!this.metaplex) {
      try {
        await this.initializeMetaplex();
        // Double check initialization succeeded
        if (!this.metaplex) {
          throw new Error('Metaplex failed to initialize properly');
        }
      } catch (error) {
        console.error('Failed to ensure Metaplex is ready:', error);
        throw new Error('Could not initialize Metaplex client');
      }
    }
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

  // Simplified rate limiting helper
  private async throttleRequest(): Promise<void> {
    while (this.activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => 
        setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
    this.activeRequests++;
  }

  private async releaseRequest(): Promise<void> {
    this.activeRequests--;
  }

  public async verifyNFTHolding(
    walletAddress: string,
    collectionAddress: string,
    minAmount: number,
    retryAttempts = 3
  ): Promise<NFTVerificationResult> {
    try {
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

      // Ensure Metaplex is ready before proceeding with any operations
      await this.ensureMetaplexReady();
      
      const walletPubKey = new PublicKey(walletAddress);
      const collectionPubKey = new PublicKey(collectionAddress);

      // Retry logic for network issues
      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= retryAttempts; attempt++) {
        try {
          // Verify Metaplex is still available (in case of connection issues)
          if (!this.metaplex) {
            await this.ensureMetaplexReady();
          }

          // Apply rate limiting before RPC call
          await this.throttleRequest();
          
          // Get all NFTs owned by the user (returns Metadata objects)
          const nfts: (Metadata | Nft | Sft)[] = await this.metaplex.nfts().findAllByOwner({ owner: walletPubKey });
          this.releaseRequest();

          // More balanced chunking
          const CHUNK_SIZE = 5; // Process 5 NFTs per chunk
          const nftChunks = this.chunkArray(nfts, CHUNK_SIZE);
          
          // Reasonable delays for rate limiting
          const MIN_CHUNK_DELAY = 200; // 200ms base delay between chunks
          const JITTER = 100; // 100ms max jitter

          const loadedNFTsArrays = await Promise.all(
            nftChunks.map(async (chunk) => {
              // Process NFTs in parallel within reasonable limits
              const chunkPromises = chunk.map(async (nft) => {
                try {
                  await this.throttleRequest();
                  const loadedNFT = await this.metaplex.nfts().load({ metadata: nft as Metadata });
                  this.releaseRequest();
                  return loadedNFT;
                } catch (error) {
                  console.error('Error loading NFT data:', error);
                  if (error instanceof Error) {
                    console.error('NFT loading error details:', {
                      message: error.message,
                      nftAddress: (nft as Metadata)?.address?.toBase58(),
                      errorType: error.name,
                      stack: error.stack
                    });
                  }
                  return null;
                }
              });

              // Add reasonable delay between chunks
              const delay = MIN_CHUNK_DELAY + Math.random() * JITTER;
              await new Promise(resolve => setTimeout(resolve, delay));
              
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
            // Enhanced exponential backoff with jitter
            const baseDelay = 2000;
            const maxJitter = 1000;
            const backoffDelay = baseDelay * Math.pow(2, attempt) + (Math.random() * maxJitter);
            console.log(`Retry attempt ${attempt + 1}/${retryAttempts} - waiting ${Math.round(backoffDelay/1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
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