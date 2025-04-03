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

    const walletPublicKey = new PublicKey(walletAddress);
    
    // First check token accounts
    console.log('Checking token accounts for wallet:', walletAddress);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPublicKey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    // Filter for NFTs (tokens with amount 1)
    const nftAccounts = tokenAccounts.value.filter(account => {
      const tokenAmount = account.account.data.parsed.info.tokenAmount;
      return tokenAmount.amount === '1' && tokenAmount.decimals === 0;
    });

    console.log('Token account analysis:', {
      total: tokenAccounts.value.length,
      nftLike: nftAccounts.length,
      mints: nftAccounts.map(acc => acc.account.data.parsed.info.mint)
    });

    if (nftAccounts.length === 0) {
      return { 
        isValid: false, 
        error: `No NFT-like tokens found in wallet. Need ${minAmount} from collection ${collectionAddress}`, 
        balance: 0 
      };
    }

    // Get mint addresses and fetch NFT data
    const mintAddresses = nftAccounts.map(account => 
      new PublicKey(account.account.data.parsed.info.mint)
    );

    console.log('Fetching metadata for mints:', mintAddresses.map(m => m.toBase58()));
    
    // Try both methods to fetch NFTs
    const [byMintList, byOwner] = await Promise.all([
      metaplex.nfts().findAllByMintList({ mints: mintAddresses }).catch(e => {
        console.warn('findAllByMintList failed:', e);
        return [];
      }),
      metaplex.nfts().findAllByOwner({ owner: walletPublicKey }).catch(e => {
        console.warn('findAllByOwner failed:', e);
        return [];
      })
    ]);

    console.log('NFT fetch results:', {
      byMintList: byMintList.length,
      byOwner: byOwner.length,
      firstMintListNFT: byMintList[0] ? {
        mint: byMintList[0].address.toBase58(),
        collection: byMintList[0].collection
      } : null,
      firstOwnerNFT: byOwner[0] ? {
        mint: byOwner[0].address.toBase58(),
        collection: byOwner[0].collection
      } : null
    });

    // Combine results and remove duplicates
    const nfts = [...new Set([...byMintList, ...byOwner])];

    // Filter NFTs by collection and verified status
    const collectionNfts = nfts.filter((nft): nft is Nft => {
      if (!nft || nft.model !== 'nft') return false;
      
      // Access the collection data from the correct location
      const collection = nft.collection;
      
      console.log('Checking NFT:', {
        mint: nft.address.toBase58(),
        metadata: {
          collection: collection,
          name: nft.name,
          uri: nft.uri
        },
        collectionMatch: {
          expected: collectionAddress,
          actual: collection?.address.toBase58(),
          matches: collection?.address.toBase58() === collectionAddress
        },
        verificationStatus: {
          isVerified: collection?.verified,
          type: typeof collection?.verified
        }
      });
      
      // Both conditions must be true for a valid collection NFT
      const isFromCollection = collection?.address.toBase58() === collectionAddress;
      const isVerified = collection?.verified === true;
      
      if (isFromCollection) {
        console.log('Found collection NFT:', {
          mint: nft.address.toBase58(),
          name: nft.name,
          verified: isVerified,
          verifiedType: typeof collection?.verified
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