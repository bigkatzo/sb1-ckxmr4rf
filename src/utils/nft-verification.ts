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
      byOwner: byOwner.length
    });

    // Combine results and remove duplicates
    const nfts = [...new Set([...byMintList, ...byOwner])];

    // Filter NFTs by collection and verified status
    const collectionNfts = nfts.filter((nft): nft is Nft => {
      if (!nft || nft.model !== 'nft') return false;
      
      // Get the raw metadata
      const metadata = nft as any;
      
      console.log('Checking NFT metadata:', {
        mint: metadata.mint || nft.address.toBase58(),
        collection: metadata.collection,
        collectionFromNft: nft.collection
      });
      
      // Check collection directly from metadata
      const isFromCollection = metadata.collection?.key === collectionAddress;
      const isVerified = metadata.collection?.verified === 1;
      
      if (isFromCollection) {
        console.log('Found collection NFT:', {
          mint: metadata.mint || nft.address.toBase58(),
          verified: isVerified,
          collection: metadata.collection
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