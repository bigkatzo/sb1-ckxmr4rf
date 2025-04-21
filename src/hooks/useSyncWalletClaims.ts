import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useWallet } from '../contexts/WalletContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * A hook that synchronizes the wallet address with JWT claims in Supabase
 * This ensures that RLS policies using auth.jwt()->>'wallet_address' work correctly
 */
export function useSyncWalletClaims() {
  const { walletAddress } = useWallet();
  const { session } = useAuth();

  useEffect(() => {
    // Only attempt to sync if both wallet is connected and user is authenticated
    if (walletAddress && session?.user) {
      // Define function to sync wallet address with JWT claims
      const syncWalletAddress = async () => {
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
          } else {
            console.log('Successfully synced wallet address to JWT claims:', walletAddress);
            
            // Get the session again to verify the update
            const { data: sessionData } = await supabase.auth.getSession();
            const updatedWalletInJWT = sessionData?.session?.user?.user_metadata?.wallet_address;
            console.log('Updated wallet in JWT:', updatedWalletInJWT);
            console.log('Matches connected wallet:', updatedWalletInJWT === walletAddress);
            
            // Debug JWT claims using our server function
            try {
              const { data: jwtDebug } = await supabase.rpc('debug_auth_jwt');
              console.log('JWT claims after sync:', jwtDebug);
            } catch (e) {
              // Function might not exist yet, so handle gracefully
              console.log('Could not debug JWT claims:', e instanceof Error ? e.message : String(e));
            }
          }
        } catch (err) {
          console.error('Exception during wallet claim sync:', err);
        }
      };

      // Execute the sync
      syncWalletAddress();
    }
  }, [walletAddress, session?.user?.id]);

  return null;
} 