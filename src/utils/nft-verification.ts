import { PublicKey } from '@solana/web3.js';
import { SOLANA_CONNECTION } from '../config/solana';

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
          const [metadataPDA] = PublicKey.findProgramAddressSync(
            [
              Buffer.from('metadata'),
              new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
              new PublicKey(account.account.data.parsed.info.mint).toBuffer()
            ],
            new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
          );
          
          const accountInfo = await connection.getAccountInfo(metadataPDA);
          if (!accountInfo) return null;

          // Skip first 1 byte (metadata version) and next 32 bytes (update authority)
          const collectionData = accountInfo.data.slice(33);
          
          // Find collection address in metadata (this is a simplification)
          const collectionStart = collectionData.indexOf(Buffer.from(collectionAddress, 'base64'));
          if (collectionStart === -1) return null;

          return account;
        } catch (error) {
          console.error('Error getting metadata for NFT:', error);
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
      required: minAmount
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