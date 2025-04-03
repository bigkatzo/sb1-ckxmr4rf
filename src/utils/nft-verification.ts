import { PublicKey } from '@solana/web3.js';
import { SOLANA_CONNECTION } from '../config/solana';
import { Buffer } from 'buffer';

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
    
    // Get all token accounts for this wallet
    const accounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    // Filter for NFTs (tokens with amount 1)
    const nftAccounts = accounts.value.filter(account => {
      const tokenAmount = account.account.data.parsed.info.tokenAmount;
      return tokenAmount.amount === '1' && tokenAmount.decimals === 0;
    });

    console.log('Found NFT accounts:', {
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

    // Get metadata accounts for these NFTs
    const metadataAccounts = await Promise.all(
      nftAccounts.map(async account => {
        try {
          const mintAddress = account.account.data.parsed.info.mint;
          const [metadataPDA] = PublicKey.findProgramAddressSync(
            [
              Buffer.from('metadata'),
              new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
              new PublicKey(mintAddress).toBuffer()
            ],
            new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
          );
          
          const accountInfo = await connection.getAccountInfo(metadataPDA);
          if (!accountInfo) return null;

          // Get metadata as JSON
          const metadata = await connection.getParsedAccountInfo(metadataPDA);
          const data = metadata.value?.data;
          if (!data || typeof data !== 'object' || !('parsed' in data)) return null;

          const collection = data.parsed.info?.collection?.key;
          if (collection === collectionAddress) {
            console.log('Found NFT from collection:', mintAddress);
            return account;
          }

          return null;
        } catch (error) {
          console.error('Error checking NFT:', error);
          return null;
        }
      })
    );

    // Count valid NFTs from the collection
    const validNFTs = metadataAccounts.filter(account => account !== null);
    const nftCount = validNFTs.length;

    console.log('NFT verification result:', {
      collection: collectionAddress,
      found: nftCount,
      required: minAmount,
      validNFTs: validNFTs.map(nft => nft?.account.data.parsed.info.mint)
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