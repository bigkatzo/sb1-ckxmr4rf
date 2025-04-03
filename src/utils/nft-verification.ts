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
    // Basic input validation with better minAmount check
    if (!walletAddress || !collectionAddress || minAmount <= 0) {
      return { isValid: false, error: 'Invalid input parameters', balance: 0 };
    }

    const connection = SOLANA_CONNECTION;
    const metaplex = Metaplex.make(connection);
    
    // Get all NFTs owned by the wallet
    const nfts = await metaplex.nfts().findAllByOwner({ 
      owner: new PublicKey(walletAddress) 
    });

    console.log('Found NFTs:', {
      total: nfts.length,
      mints: nfts.map(nft => nft.address.toBase58())
    });

    if (!nfts.length) {
      return { 
        isValid: false, 
        error: `No NFTs found in wallet. Need ${minAmount} from collection ${collectionAddress}`, 
        balance: 0 
      };
    }

    // Filter NFTs by collection and verified status
    const collectionNfts = nfts.filter((nft): nft is Nft => {
      if (!nft || nft.model !== 'nft') return false;
      
      const isFromCollection = nft.collection?.address.toBase58() === collectionAddress;
      const isVerified = nft.collection?.verified ?? false;
      
      if (isFromCollection) {
        console.log('Found collection NFT:', {
          mint: nft.address.toBase58(),
          verified: isVerified
        });
      }
      
      return isFromCollection && isVerified;
    });

    const nftCount = collectionNfts.length;
    console.log('NFT verification result:', {
      collection: collectionAddress,
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