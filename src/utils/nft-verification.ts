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
  private isInitialized: boolean = false;
  private isInitializing: boolean = false;
  
  // Rate limiting configuration
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 100; // 100ms between requests (10 RPS max)
  private readonly MAX_CONCURRENT_REQUESTS = 4; // Allow up to 4 concurrent requests
  private readonly CHUNK_SIZE = 5; // Process 5 NFTs per chunk
  private readonly MIN_CHUNK_DELAY = 200; // Base delay between chunks
  private readonly MAX_CHUNK_DELAY = 300; // Max delay with jitter
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
    // If already initialized, return immediately
    if (this.isInitialized && this.metaplex) {
      return Promise.resolve();
    }

    // If currently initializing, wait for the existing promise
    if (this.isInitializing && this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.isInitializing = true;
    this.initializationPromise = (async () => {
      try {
        // Dynamic import of Metaplex
        const { Metaplex } = await import('@metaplex-foundation/js').catch((error: unknown) => {
          console.error('Failed to import Metaplex:', error);
          throw new Error(`Failed to import Metaplex: ${error instanceof Error ? error.message : 'Unknown error'}`);
        });

        // Create Metaplex instance
        try {
          this.metaplex = Metaplex.make(this.connection);
          this.isInitialized = true;
        } catch (error) {
          console.error('Failed to create Metaplex instance:', error);
          throw new Error(`Failed to create Metaplex instance: ${error.message || 'Unknown error'}`);
        }
      } catch (error) {
        // Clean up on any error
        this.metaplex = null;
        this.isInitialized = false;
        this.initializationPromise = null;
        throw error;
      } finally {
        // Always reset initializing flag
        this.isInitializing = false;
      }
    })();

    return this.initializationPromise;
  }

  // Add method to check if Metaplex is ready
  private async ensureMetaplexReady(): Promise<void> {
    try {
      // If already initialized and instance exists, return immediately
      if (this.isInitialized && this.metaplex) {
        return;
      }

      // Attempt initialization
      await this.initializeMetaplex();

      // Verify initialization succeeded
      if (!this.metaplex) {
        throw new Error('Metaplex failed to initialize properly');
      }
    } catch (error) {
      // Reset state on failure
      this.isInitialized = false;
      this.metaplex = null;
      this.initializationPromise = null;
      this.isInitializing = false;
      
      console.error('Failed to ensure Metaplex is ready:', error);
      throw error; // Preserve original error
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

  // Enhanced chunk array method with size validation
  private chunkArray<T>(array: T[], size: number): T[][] {
    if (!Array.isArray(array)) {
      throw new Error('Input must be an array');
    }
    if (size < 1) {
      throw new Error('Chunk size must be at least 1');
    }
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

  private async processNFTChunk(chunk: (Metadata | Nft | Sft)[], attempt: number): Promise<(Nft | null)[]> {
    try {
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
              stack: error.stack,
              attempt: attempt
            });
          }
          return null;
        }
      });

      // Add dynamic delay based on chunk size and attempt number
      const baseDelay = this.MIN_CHUNK_DELAY;
      const maxJitter = this.MAX_CHUNK_DELAY - this.MIN_CHUNK_DELAY;
      const dynamicDelay = baseDelay + (Math.random() * maxJitter);
      
      // Increase delay for retry attempts
      const retryMultiplier = Math.max(1, attempt);
      await new Promise(resolve => setTimeout(resolve, dynamicDelay * retryMultiplier));
      
      return Promise.all(chunkPromises);
    } catch (error) {
      console.error(`Error processing NFT chunk:`, error);
      return new Array(chunk.length).fill(null);
    }
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
          // Verify Metaplex is still available
          if (!this.metaplex) {
            await this.ensureMetaplexReady();
          }

          // Apply rate limiting before RPC call
          await this.throttleRequest();
          
          // Get all NFTs owned by the user
          const nfts: (Metadata | Nft | Sft)[] = await this.metaplex.nfts().findAllByOwner({ owner: walletPubKey });
          this.releaseRequest();

          // Split into chunks with configured size
          const nftChunks = this.chunkArray(nfts, this.CHUNK_SIZE);
          
          // Process chunks with enhanced error handling
          const loadedNFTsArrays = await Promise.all(
            nftChunks.map(chunk => this.processNFTChunk(chunk, attempt))
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

// Update preload function to be more reliable
export function preloadNFTVerifier(): void {
  // Preload immediately but don't block
  const verifier = NFTVerifier.getInstance();
  verifier.initializeMetaplex().catch(err => {
    // Silent fail on preload but log for debugging
    console.debug('NFT Verifier preload failed:', err);
  });
}

// Update initialization function
export async function initializeNFTVerifier(): Promise<void> {
  try {
    const verifier = NFTVerifier.getInstance();
    await verifier.initializeMetaplex();
    console.log('NFT Verifier and Metaplex initialized successfully');
  } catch (error) {
    console.error('Failed to initialize NFT Verifier:', error);
    throw error;
  }
} 