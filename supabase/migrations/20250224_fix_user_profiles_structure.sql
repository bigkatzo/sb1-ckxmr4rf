-- Fix user_profiles table structure
-- This migration ensures the user_profiles table has all required columns

-- First, let's check if we need to add any missing columns
DO $$ 
BEGIN
    -- Add display_name if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'display_name'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN display_name TEXT;
    END IF;

    -- Add description if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'description'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN description TEXT;
    END IF;

    -- Add payout_wallet if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'payout_wallet'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN payout_wallet TEXT;
    END IF;

    -- Make sure email column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'email'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN email TEXT;
        
        -- Update existing profiles with emails from auth.users if possible
        -- This is safe because we're only reading from auth.users
        BEGIN
            UPDATE user_profiles
            SET email = au.email
            FROM auth.users au
            WHERE user_profiles.id = au.id;
        EXCEPTION WHEN OTHERS THEN
            RAISE LOG 'Error updating email from auth.users: %', SQLERRM;
            -- Continue execution even if this fails
        END;
    END IF;
END $$;

-- Make sure we have proper RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Safer policy creation - only drop if we're going to create new ones
DO $$
DECLARE
    policy_exists BOOLEAN;
BEGIN
    -- Check if users_read_own_profile already exists
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'users_read_own_profile'
    ) INTO policy_exists;
    
    -- Only drop and recreate if it doesn't exist
    IF NOT policy_exists THEN
        -- Drop old policies that might conflict
        DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
        
        -- Create the policy
        CREATE POLICY "users_read_own_profile"
          ON user_profiles
          FOR SELECT
          TO authenticated
          USING (id = auth.uid());
    END IF;
    
    -- Check if users_update_own_profile already exists
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'users_update_own_profile'
    ) INTO policy_exists;
    
    -- Only drop and recreate if it doesn't exist
    IF NOT policy_exists THEN
        -- Drop old policies that might conflict
        DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
        
        -- Create the policy
        CREATE POLICY "users_update_own_profile"
          ON user_profiles
          FOR UPDATE
          TO authenticated
          USING (id = auth.uid())
          WITH CHECK (id = auth.uid());
    END IF;
END $$;

-- Create email uniqueness index only if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' AND tablename = 'user_profiles' AND indexname = 'user_profiles_email_unique_idx'
    ) THEN
        -- Create unique index if it doesn't exist
        CREATE UNIQUE INDEX user_profiles_email_unique_idx ON user_profiles (email) WHERE email IS NOT NULL;
    END IF;
END $$; 