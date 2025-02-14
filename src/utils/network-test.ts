import { PublicKey } from '@solana/web3.js';
import { SOLANA_CONNECTION, MERCHANT_WALLET } from '../config/solana';

export async function testSolanaConnection(): Promise<boolean> {
  try {
    console.log('🔄 Testing Solana network connection...');
    
    // Test with multiple retries
    let success = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!success && attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`Attempt ${attempts}/${maxAttempts}`);

        // Test basic connection with timeout
        const versionPromise = SOLANA_CONNECTION.getVersion();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        );
        
        const version = await Promise.race([versionPromise, timeoutPromise])
          .catch(error => {
            throw new Error(`Version check failed: ${error.message}`);
          });
        
        console.log('✅ Connected to Solana network:', version);

        // Test slot with timeout
        const slotPromise = SOLANA_CONNECTION.getSlot('finalized');
        const slot = await Promise.race([
          slotPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Slot check timeout')), 5000))
        ]).catch(error => {
          throw new Error(`Slot check failed: ${error.message}`);
        });
        
        console.log('✅ Current slot:', slot);

        // Test balance retrieval with timeout
        const merchantPubkey = new PublicKey(MERCHANT_WALLET);
        const balancePromise = SOLANA_CONNECTION.getBalance(merchantPubkey, 'confirmed');
        const balance = await Promise.race([
          balancePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Balance check timeout')), 5000))
        ]).catch(error => {
          throw new Error(`Balance check failed: ${error.message}`);
        });
        
        if (typeof balance !== 'number' || isNaN(balance)) {
          throw new Error('Invalid balance response');
        }

        const balanceInSol = balance / 1000000000;
        console.log('✅ Merchant wallet balance:', balanceInSol, 'SOL');
        
        success = true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Attempt ${attempts} failed: ${errorMessage}`);
        
        if (attempts < maxAttempts) {
          // Exponential backoff with jitter
          const baseDelay = 1000 * Math.pow(2, attempts - 1);
          const jitter = Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
        }
      }
    }

    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Solana network test failed:', errorMessage);
    return false;
  }
}