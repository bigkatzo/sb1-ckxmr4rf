import { PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';
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

    // Fetch all NFTs owned by the user
    const allTokens = await metaplex.nfts().findAllByOwner({ owner: walletPubKey });

    // Filter tokens that belong to the desired collection and are verified
    const matchingNFTs = allTokens.filter((nft) => 
      nft.collection?.address.toString() === collectionAddress && 
      nft.collection.verified
    );

    const nftCount = matchingNFTs.length;

    // Log verification details for debugging
    console.log('NFT Verification:', {
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