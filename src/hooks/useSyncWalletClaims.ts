import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * A hook that synchronizes the wallet address with JWT claims in Supabase
 * This ensures that RLS policies using auth.jwt()->>'wallet_address' work correctly
 * Updated to work with Privy wallet integration
 */
export function useSyncWalletClaims() {
  const { walletAddress, authenticated } = useWallet();
  const { session } = useAuth();
  const [lastSyncedWallet, setLastSyncedWallet] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  useEffect(() => {
    // Only attempt to sync if:
    // 1. Wallet is connected and authenticated via Privy
    // 2. User is authenticated with Supabase
    // 3. Wallet address has changed since last sync or we haven't synced it yet
    if (walletAddress && authenticated && session?.user && walletAddress !== lastSyncedWallet) {
      // Define function to sync wallet address with JWT claims
      const syncWalletAddress = async () => {
        setSyncStatus('syncing');
        
        try {
          // Update the user's metadata to include the current wallet address
          // We set it in user_metadata which is the preferred location
          // The server RLS will check multiple locations in the JWT
          const { error } = await supabase.auth.updateUser({
            data: { 
              wallet_address: walletAddress,
              // Add a timestamp to ensure the update is processed
              wallet_updated_at: new Date().toISOString()
            }
          });

          if (error) {
            console.error('Error updating user metadata with wallet address:', error);
            setSyncStatus('error');
            return;
          }
          
          console.log('Successfully synced wallet address to JWT claims:', walletAddress);
          setLastSyncedWallet(walletAddress);
          setSyncStatus('success');
          
          // Get the session again to verify the update
          const { data: sessionData } = await supabase.auth.getSession();
          const updatedWalletInJWT = sessionData?.session?.user?.user_metadata?.wallet_address;
          console.log('Updated wallet in JWT:', updatedWalletInJWT);
          console.log('Matches connected wallet:', updatedWalletInJWT === walletAddress);
          
          // Debug JWT claims using our server function
          try {
            const { data: jwtDebug } = await supabase.rpc('debug_jwt_wallet');
            console.log('JWT claims after sync:', jwtDebug);
            
            // Verify that the wallet access check is working
            const walletAccessWorks = jwtDebug?.wallet_access_works;
            if (walletAccessWorks !== true) {
              console.warn('Wallet access verification failed, this may cause RLS issues', jwtDebug);
              
              // Do another update attempt with alternative strategy if the check failed
              if (sessionData?.session) {
                console.log('Trying alternative JWT update method...');
                await supabase.auth.refreshSession();
                await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
                
                // Try again with a more specific approach
                // Note: We can't directly set app_metadata as it's managed by the server
                // Instead we'll use custom RPC if needed
                const updatedData = { 
                  wallet_address: walletAddress,
                  wallet_updated_at: new Date().toISOString(),
                  // Add a flag to indicate this is a retry attempt
                  wallet_sync_retry: true
                };
                
                await supabase.auth.updateUser({
                  data: updatedData
                });
                
                // Try a custom function call if available
                try {
                  await supabase.rpc('sync_wallet_to_jwt', { 
                    wallet_addr: walletAddress 
                  });
                } catch (e) {
                  // Function might not exist, that's ok
                  console.log('RPC sync not available:', e instanceof Error ? e.message : String(e));
                }
                
                // Verify again
                const { data: finalCheck } = await supabase.rpc('debug_jwt_wallet');
                console.log('Final JWT verification:', finalCheck);
              }
            }
          } catch (e) {
            // Function might not exist yet, so handle gracefully
            console.log('Could not debug JWT claims:', e instanceof Error ? e.message : String(e));
          }
        } catch (err) {
          console.error('Exception during wallet claim sync:', err);
          setSyncStatus('error');
        }
      };

      // Execute the sync
      syncWalletAddress();
    }
  }, [walletAddress, authenticated, session?.user?.id, lastSyncedWallet]);

  return {
    lastSyncedWallet,
    syncStatus
  };
} 