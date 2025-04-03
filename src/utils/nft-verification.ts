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

          // Parse metadata according to Metaplex standard
          // Skip version (1 byte) and update authority (32 bytes)
          let offset = 1 + 32;
          
          // Skip mint (32 bytes)
          offset += 32;
          
          // Skip name string length (4 bytes) and name
          const nameLength = accountInfo.data.readUInt32LE(offset);
          offset += 4 + nameLength;
          
          // Skip symbol string length (4 bytes) and symbol
          const symbolLength = accountInfo.data.readUInt32LE(offset);
          offset += 4 + symbolLength;
          
          // Skip uri string length (4 bytes) and uri
          const uriLength = accountInfo.data.readUInt32LE(offset);
          offset += 4 + uriLength;
          
          // Skip seller fee basis points (2 bytes)
          offset += 2;
          
          // Skip creator array (if present)
          const hasCreators = accountInfo.data[offset] === 1;
          offset += 1;
          if (hasCreators) {
            const numCreators = accountInfo.data.readUInt32LE(offset);
            offset += 4 + (numCreators * 34); // Each creator is 34 bytes
          }

          // Collection data starts here
          // Check if uses field exists (1 byte)
          const hasUses = accountInfo.data[offset] === 1;
          offset += 1;
          if (hasUses) {
            offset += 17; // Skip uses struct
          }

          // Now we're at collection data
          const hasCollection = accountInfo.data[offset] === 1;
          offset += 1;

          if (hasCollection) {
            // Read collection key (32 bytes)
            const collectionKey = new PublicKey(accountInfo.data.slice(offset, offset + 32));
            
            // Check if this NFT belongs to the target collection
            if (collectionKey.toBase58() === collectionAddress) {
              console.log('Found NFT from collection:', account.account.data.parsed.info.mint);
              return account;
            } else {
              console.log('NFT collection mismatch:', {
                nft: account.account.data.parsed.info.mint,
                collection: collectionKey.toBase58(),
                expected: collectionAddress
              });
            }
          }

          return null;
        } catch (error) {
          console.error('Error parsing metadata for NFT:', error);
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