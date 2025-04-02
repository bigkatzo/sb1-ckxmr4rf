import { PublicKey } from '@solana/web3.js';
import { Metaplex, Nft, Metadata, Sft } from '@metaplex-foundation/js';
import { SOLANA_CONNECTION } from '../config/solana';

export interface NFTVerificationResult {
  isValid: boolean;
  error?: string;
  balance?: number;
}

// Initialize Metaplex with our connection
const metaplex = new Metaplex(SOLANA_CONNECTION);

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

    console.log('Starting NFT verification for:', {
      wallet: walletAddress,
      collection: collectionAddress
    });

    // First verify the collection exists
    try {
      const collectionNft = await metaplex.nfts().findByMint({ mintAddress: collectionPubKey });
      console.log('Collection NFT found:', {
        name: collectionNft.name,
        address: collectionNft.address.toString(),
        verified: collectionNft.collection?.verified
      });
    } catch (error) {
      console.error('Error fetching collection:', error);
    }

    // Fetch all NFTs owned by the user with retries
    let allTokens: (Metadata | Nft | Sft)[] = [];
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`Attempt ${retryCount + 1} to fetch NFTs...`);
        allTokens = await metaplex.nfts().findAllByOwner({ owner: walletPubKey });
        break;
      } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error);
        retryCount++;
        if (retryCount === maxRetries) {
          throw new Error('Failed to fetch NFTs after multiple attempts');
        }
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
      }
    }

    console.log('Found total NFTs:', allTokens.length);

    // Log all NFTs for debugging
    allTokens.forEach((nft, index) => {
      console.log(`NFT ${index + 1}:`, {
        mint: nft.address.toString(),
        name: nft.name,
        collection: nft.collection?.address.toString(),
        verified: nft.collection?.verified
      });
    });

    // Filter tokens that belong to the desired collection and are verified
    const matchingNFTs = allTokens.filter((nft) => {
      const matches = nft.collection?.address.toString() === collectionAddress;
      const isVerified = nft.collection?.verified === true;
      console.log('Checking NFT:', {
        mint: nft.address.toString(),
        collectionMatches: matches,
        isVerified: isVerified
      });
      return matches && isVerified;
    });

    const nftCount = matchingNFTs.length;

    // Log verification details for debugging
    console.log('NFT Verification Result:', {
      walletAddress,
      collectionAddress,
      totalNFTs: allTokens.length,
      matchingNFTs: nftCount,
      matchingDetails: matchingNFTs.map(nft => ({
        mint: nft.address.toString(),
        name: nft.name,
        collection: nft.collection?.address.toString(),
        verified: nft.collection?.verified
      }))
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

// Helper function to validate Solana address format
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
} 