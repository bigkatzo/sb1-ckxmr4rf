import { PublicKey } from '@solana/web3.js';
import { Metaplex, Nft, Metadata, Sft } from '@metaplex-foundation/js';
import { SOLANA_CONNECTION } from '../config/solana';

export interface NFTVerificationResult {
  isValid: boolean;
  error?: string;
  balance?: number;
}

export async function verifyNFTHolding(
  walletAddress: string,
  collectionAddress: string,
  minAmount: number
): Promise<NFTVerificationResult> {
  try {
    const walletPubKey = new PublicKey(walletAddress);
    const collectionPubKey = new PublicKey(collectionAddress);
    const metaplex = Metaplex.make(SOLANA_CONNECTION);

    // Get all NFTs owned by the user
    const nfts = await metaplex.nfts().findAllByOwner({ owner: walletPubKey });

    // Filter NFTs that belong to the specified verified collection
    const matchingNFTs = nfts.filter((nft: Metadata | Nft | Sft) => {
      return (
        'collection' in nft &&
        nft.collection &&
        nft.collection.verified === true &&
        nft.collection.address.toBase58() === collectionPubKey.toBase58()
      );
    });

    const nftCount = matchingNFTs.length;

    // Debug information
    console.log('NFT Verification Debug:', {
      walletAddress: walletAddress,
      collectionAddress: collectionAddress,
      totalNFTs: nfts.length,
      matchingNFTs: nftCount,
      matchingNFTDetails: matchingNFTs.map((nft: Metadata | Nft | Sft) => ({
        mint: nft.address.toBase58(),
        collection: nft.collection ? {
          address: nft.collection.address.toBase58(),
          verified: nft.collection.verified
        } : null
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