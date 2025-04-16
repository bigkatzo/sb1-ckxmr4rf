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
    
    try {
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
      
      // Try loading full NFT data for each NFT - this can help with metadata issues
      console.log('Loading full NFT data for better metadata...');
      const loadedNfts = await Promise.all(
        nfts.filter(nft => nft.model === 'nft')
          .map(async (nft) => {
            try {
              // Load full NFT data
              return await metaplex.nfts().load({ metadata: nft });
            } catch (e) {
              console.error(`Error loading full data for NFT ${nft.address.toBase58()}:`, e);
              return nft; // Return original if loading fails
            }
          })
      );
      
      console.log(`Loaded detailed data for ${loadedNfts.length} NFTs`);
      
      // Log the loaded NFTs with their collection data
      loadedNfts.forEach((nft, i) => {
        console.log(`Loaded NFT #${i+1}:`, {
          name: nft.name,
          mint: nft.address.toBase58(),
          hasCollection: !!nft.collection,
          collection: nft.collection ? nft.collection.address.toBase58() : 'No collection',
          verified: nft.collection ? nft.collection.verified : false
        });
      });
      
      // Filter NFTs by collection and verified status
      const collectionNfts = loadedNfts.filter((nft): nft is Nft => {
        if (!nft || nft.model !== 'nft') return false;
        
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
    } catch (nftError) {
      console.error('Error in NFT fetching process:', nftError);
      
      // Try an alternative approach - get all mint accounts and check metadata
      console.log('Trying alternative approach - fetching token accounts...');
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );
      
      console.log(`Found ${tokenAccounts.value.length} token accounts`);
      
      // Filter for accounts with amount 1 (potential NFTs)
      const nftAccounts = tokenAccounts.value.filter(account => {
        const tokenAmount = account.account.data.parsed.info.tokenAmount;
        return tokenAmount.amount === '1' && tokenAmount.decimals === 0;
      });
      
      console.log(`Found ${nftAccounts.length} potential NFT accounts`);
      
      // If we found potential NFTs, try to get their metadata
      if (nftAccounts.length > 0) {
        try {
          // Get mint addresses
          const mintAddresses = nftAccounts.map(account => 
            new PublicKey(account.account.data.parsed.info.mint)
          );
          
          console.log('Fetching metadata for mints:', mintAddresses.map(m => m.toBase58()));
          
          // Try to load NFTs by mint addresses
          const mintNfts = await metaplex.nfts().findAllByMintList({ mints: mintAddresses });
          console.log(`Found ${mintNfts.length} NFTs by mint list`);
          
          // Filter for the collection
          const collectionNfts = mintNfts.filter((nft): nft is Nft => {
            if (!nft || nft.model !== 'nft') return false;
            
            const collection = nft.collection;
            if (!collection) return false;
            
            const nftCollectionAddress = collection.address.toBase58();
            const isFromCollection = nftCollectionAddress === cleanCollectionAddress;
            const isVerified = collection.verified === true;
            
            return isFromCollection && isVerified;
          });
          
          const nftCount = collectionNfts.length;
          console.log('Alternative verification result:', {
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
        } catch (mintError) {
          console.error('Error in alternative NFT check:', mintError);
          throw mintError; // Pass to the outer catch
        }
      } else {
        throw nftError; // Pass to the outer catch if no potential NFTs found
      }
    }
  } catch (error) {
    console.error('Error verifying NFT balance:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to verify NFT balance',
      balance: 0
    };
  }
}