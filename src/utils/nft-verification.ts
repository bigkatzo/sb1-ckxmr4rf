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
    if (!walletAddress || !collectionAddress || minAmount < 0) {
      return { isValid: false, error: 'Invalid input parameters', balance: 0 };
    }

    const connection = SOLANA_CONNECTION;
    const metaplex = Metaplex.make(connection);
    
    // First get all token accounts for this wallet
    const accounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    // Filter for NFTs (tokens with amount 1)
    const nftAccounts = accounts.value.filter(account => {
      const tokenAmount = account.account.data.parsed.info.tokenAmount;
      return tokenAmount.amount === '1' && tokenAmount.decimals === 0;
    });

    console.log('Found token accounts:', {
      total: accounts.value.length,
      nfts: nftAccounts.length
    });

    if (nftAccounts.length === 0) {
      return {
        isValid: false,
        error: `No NFTs found. You need ${minAmount} NFT(s) from this collection.`,
        balance: 0
      };
    }

    // Get mint addresses
    const mintAddresses = nftAccounts.map(account => 
      new PublicKey(account.account.data.parsed.info.mint)
    );

    // Load NFT metadata for all tokens
    const nfts = await metaplex.nfts().findAllByMintList({ mints: mintAddresses });
    
    console.log('Loaded NFT metadata:', {
      total: nfts.length,
      mints: mintAddresses.map(mint => mint.toBase58())
    });

    // Filter NFTs by collection and verified status
    const collectionNfts = nfts.filter((nft): nft is Nft => {
      const isFromCollection = nft?.collection?.address.toBase58() === collectionAddress;
      const isVerified = nft?.collection?.verified ?? false;
      
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
             `You need ${minAmount} NFT(s) from this collection, but only have ${nftCount}`
    };
  } catch (error) {
    console.error('Error verifying NFT balance:', error);
    return {
      isValid: false,
      error: 'Failed to verify NFT balance',
      balance: 0
    };
  }
} 