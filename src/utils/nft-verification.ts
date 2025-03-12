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

// Helper function to parse metadata collection from buffer
function parseMetadataCollection(buffer: Buffer): PublicKey | null {
  try {
    // Skip the first 1 + 32 + 32 + 4 bytes (version + update auth + mint + name length)
    let offset = 69;
    
    // Skip name
    const nameLen = buffer.readUInt32LE(65);
    offset += nameLen;
    
    // Skip symbol
    const symbolLen = buffer.readUInt32LE(offset);
    offset += 4 + symbolLen;
    
    // Skip uri
    const uriLen = buffer.readUInt32LE(offset);
    offset += 4 + uriLen;
    
    // Skip creators if present
    const hasCreators = buffer[offset];
    offset += 1;
    if (hasCreators) {
      const creatorsLen = buffer.readUInt32LE(offset);
      offset += 4 + (creatorsLen * 34); // Each creator is 34 bytes
    }
    
    // Skip collection parent bool
    offset += 1;
    
    // Get collection address
    const collection = new PublicKey(buffer.slice(offset, offset + 32));
    return collection;
  } catch (error) {
    console.error('Error parsing metadata:', error);
    return null;
  }
} 