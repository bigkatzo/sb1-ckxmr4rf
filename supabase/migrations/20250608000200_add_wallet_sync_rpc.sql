-- Add a custom RPC function to help with wallet synchronization
BEGIN;

-- Create an RPC function that can be called from client to ensure wallet is properly synced
CREATE OR REPLACE FUNCTION sync_wallet_to_jwt(wallet_addr text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  updated boolean := false;
BEGIN
  -- Verify the user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;
  
  -- Check if the wallet is already accessible via check_wallet_access
  IF check_wallet_access(wallet_addr) THEN
    -- Already synced properly, just return success
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Wallet already properly synced with JWT'
    );
  END IF;
  
  -- Wallet not properly synced in JWT - attempt to register in database
  -- This is a fallback mechanism when JWT claims aren't working
  BEGIN
    -- Check if wallets table exists
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'wallets'
    ) THEN
      -- Check if wallet already exists for this user
      IF NOT EXISTS (
        SELECT 1 FROM wallets 
        WHERE wallet_address = wallet_addr 
        AND user_id = auth.uid()
      ) THEN
        -- Insert wallet association
        INSERT INTO wallets (user_id, wallet_address, created_at)
        VALUES (auth.uid(), wallet_addr, now());
        updated := true;
      END IF;
    ELSE
      -- Create a simple wallets table if it doesn't exist
      CREATE TABLE IF NOT EXISTS wallets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        wallet_address text NOT NULL,
        created_at timestamp with time zone DEFAULT now(),
        UNIQUE (user_id, wallet_address)
      );
      
      -- Add indexes
      CREATE INDEX IF NOT EXISTS wallets_user_id_idx ON wallets(user_id);
      CREATE INDEX IF NOT EXISTS wallets_wallet_address_idx ON wallets(wallet_address);
      
      -- Create RLS policies
      ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
      
      -- Users can see their own wallet associations
      CREATE POLICY wallets_select_own ON wallets 
        FOR SELECT USING (user_id = auth.uid());
        
      -- Users can create their own wallet associations
      CREATE POLICY wallets_insert_own ON wallets 
        FOR INSERT WITH CHECK (user_id = auth.uid());
        
      -- Users can only delete their own wallet associations
      CREATE POLICY wallets_delete_own ON wallets 
        FOR DELETE USING (user_id = auth.uid());
      
      -- Insert the initial wallet record
      INSERT INTO wallets (user_id, wallet_address, created_at)
      VALUES (auth.uid(), wallet_addr, now());
      updated := true;
    END IF;
    
    -- Run JWT debug function to check final state
    result := debug_jwt_wallet();
    
    -- Add operation info to result
    result := result || jsonb_build_object(
      'success', true,
      'wallet_updated', updated,
      'message', CASE 
                   WHEN updated THEN 'Successfully registered wallet in database' 
                   ELSE 'Wallet already registered in database'
                 END
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Return error info
    result := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', 'Error registering wallet'
    );
  END;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION sync_wallet_to_jwt(text) TO authenticated;

-- Add a comment explaining the function
COMMENT ON FUNCTION sync_wallet_to_jwt IS 'RPC function to synchronize wallet address with JWT claims and database when normal JWT sync fails';

COMMIT; 