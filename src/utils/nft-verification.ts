import { PublicKey } from '@solana/web3.js';
import { SOLANA_CONNECTION } from '../config/solana';
import { Metaplex, Nft } from '@metaplex-foundation/js';

export interface NFTVerificationResult {
  isValid: boolean;
  error?: string;
  balance?: number;
}

export async function verifyNFTHolding(
  walletAddress: string,
  collectionAddress: string,
  minAmount: number = 1
): Promise<NFTVerificationResult> {
  try {
    // Basic input validation
    if (!walletAddress || !collectionAddress || minAmount <= 0) {
      return { isValid: false, error: 'Invalid input parameters', balance: 0 };
    }

    // Clean up the collection address (trim whitespace)
    const cleanCollectionAddress = collectionAddress.trim();
    
    console.log('Verifying NFT holding for wallet:', walletAddress);
    console.log('Collection address:', cleanCollectionAddress);
    console.log('Min amount required:', minAmount);

    const connection = SOLANA_CONNECTION;
    const metaplex = Metaplex.make(connection);
    const walletPublicKey = new PublicKey(walletAddress);
    
    // Use the proven approach: get all NFTs owned by the wallet
    console.log('Fetching all NFTs for wallet...');
    const nfts = await metaplex.nfts().findAllByOwner({ owner: walletPublicKey });
    console.log(`Found ${nfts.length} total NFTs in wallet`);
    
    // Debug each NFT's model type
    console.log('NFT models:', nfts.map(nft => nft.model));
    
    // Log all NFTs regardless of collection to see what we're getting
    nfts.forEach((nft, i) => {
      console.log(`NFT #${i+1}:`, {
        model: nft.model,
        name: nft.name,
        mint: nft.address.toBase58(),
        hasCollection: !!nft.collection,
        collection: nft.collection ? nft.collection.address.toBase58() : 'No collection',
        verified: nft.collection ? nft.collection.verified : false
      });
    });
    
    // Filter NFTs by collection and verified status
    // Accept both 'nft' and 'metadata' models since Metaplex might return either
    const collectionNfts = nfts.filter((nft) => {
      // Check if this is an NFT-like object (either 'nft' or 'metadata' model)
      if (!nft || (nft.model !== 'nft' && nft.model !== 'metadata')) {
        return false;
      }
      
      const collection = nft.collection;
      if (!collection) {
        console.log(`NFT ${nft.address.toBase58()} has no collection`);
        return false;
      }
      
      // Check if this NFT belongs to the target collection and is verified
      const nftCollectionAddress = collection.address.toBase58();
      const isFromCollection = nftCollectionAddress === cleanCollectionAddress;
      const isVerified = collection.verified === true;
      
      console.log(`Checking NFT ${nft.address.toBase58()}:`, {
        collectionMatches: isFromCollection,
        expected: cleanCollectionAddress,
        actual: nftCollectionAddress,
        isVerified: isVerified
      });
      
      return isFromCollection && isVerified;
    });

    const nftCount = collectionNfts.length;
    console.log('NFT verification final result:', {
      collection: cleanCollectionAddress,
      found: nftCount,
      required: minAmount,
      nfts: collectionNfts.map(nft => nft.address.toBase58())
    });

    return {
      isValid: nftCount >= minAmount,
      balance: nftCount,
      error: nftCount >= minAmount ? undefined : 
             `You need ${minAmount} verified NFT(s) from this collection, but only have ${nftCount}`
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