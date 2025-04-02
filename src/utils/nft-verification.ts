import { PublicKey, Connection } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';
import { SOLANA_CONNECTION } from '../config/solana';

export interface NFTVerificationResult {
  isValid: boolean;
  error?: string;
  balance?: number;
}

// Simple connection setup
const connection = new Connection(SOLANA_CONNECTION.rpcEndpoint, {
  commitment: 'confirmed'
});

const metaplex = Metaplex.make(connection);

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
    
    // Get all NFTs owned by the user
    const nfts = await metaplex.nfts().findAllByOwner({ owner: walletPubKey });

    // Filter NFTs that belong to the desired collection and are verified
    const matchingNFTs = nfts.filter((nft) => 
      nft.collection?.address.toBase58() === collectionAddress &&
      nft.collection.verified
    );

    const nftCount = matchingNFTs.length;

    // Log verification details for debugging
    console.log('NFT Verification:', {
      walletAddress,
      collectionAddress,
      totalNFTs: nfts.length,
      matchingNFTs: nftCount,
      matchingDetails: matchingNFTs.map(nft => ({
        mint: nft.address.toBase58(),
        name: nft.name,
        collection: nft.collection?.address.toBase58()
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