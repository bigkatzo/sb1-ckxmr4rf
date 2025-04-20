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
          const { error } = await supabase.auth.updateUser({
            data: { wallet_address: walletAddress }
          });

          if (error) {
            console.error('Error updating user metadata with wallet address:', error);
          } else {
            console.log('Successfully synced wallet address to JWT claims:', walletAddress);
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