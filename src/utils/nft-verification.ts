import { Connection, PublicKey } from '@solana/web3.js';
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

    // Get all token accounts owned by the wallet
    const tokenAccounts = await SOLANA_CONNECTION.getParsedTokenAccountsByOwner(walletPubKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') // SPL Token program ID
    });

    // Filter and count NFTs from the specified collection
    let nftCount = 0;
    for (const account of tokenAccounts.value) {
      const tokenAmount = account.account.data.parsed.info.tokenAmount;
      
      // Check if it's an NFT (decimals === 0) and the amount is 1
      if (tokenAmount.decimals === 0 && tokenAmount.amount === '1') {
        const mint = account.account.data.parsed.info.mint;
        
        try {
          // Get metadata account
          const [metadataAddress] = await PublicKey.findProgramAddress(
            [
              Buffer.from('metadata'),
              new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(), // Metaplex program ID
              new PublicKey(mint).toBuffer()
            ],
            new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s') // Metaplex program ID
          );

          // Get metadata account info
          const metadataInfo = await SOLANA_CONNECTION.getAccountInfo(metadataAddress);
          
          if (metadataInfo) {
            // Parse metadata to check collection
            const collection = parseMetadataCollection(metadataInfo.data);
            if (collection && collection.equals(collectionPubKey)) {
              nftCount++;
            }
          }
        } catch (error) {
          console.error('Error checking NFT metadata:', error);
          // Continue checking other tokens
          continue;
        }
      }
    }

    return {
      isValid: nftCount >= minAmount,
      balance: nftCount
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