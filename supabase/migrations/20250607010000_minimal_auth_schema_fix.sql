-- Minimal non-disruptive fix for merchant authentication "Database error querying schema"
BEGIN;

-- This migration is a minimal fix that addresses only the immediate issue
-- without changing the existing authentication system structure

-- First, fix any missing or null values in critical auth fields that might be causing the error
-- These updates only affect rows with NULL values, preserving existing data
UPDATE auth.users
SET aud = 'authenticated' 
WHERE aud IS NULL;

UPDATE auth.users
SET role = 'authenticated' 
WHERE role IS NULL;

-- Check if providers column exists before attempting update
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'providers'
  ) THEN
    -- Only run if column exists
    EXECUTE 'UPDATE auth.users SET providers = ARRAY[''email''] WHERE providers IS NULL OR providers = ''{}''';
  END IF;
END $$;

-- Fix incomplete app_metadata without changing existing values
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('provider', 'email', 'providers', ARRAY['email'])
WHERE raw_app_meta_data->>'provider' IS NULL;

-- Fix identity_data without changing existing values
-- Check if identities table exists first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'identities'
  ) THEN
    -- Only run if table exists
    EXECUTE 'UPDATE auth.identities 
            SET identity_data = identity_data || jsonb_build_object(''email_verified'', true)
            WHERE identity_data->>''email_verified'' IS NULL';
  END IF;
END $$;

-- Add missing table permissions that might be causing authentication issues
-- These permissions are necessary for authentication to work properly
DO $$
BEGIN
    -- Ensure basic auth table permissions exist
    EXECUTE 'GRANT SELECT ON auth.users TO authenticated';
    
    -- Check if identities table exists before granting permissions
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'identities'
    ) THEN
        EXECUTE 'GRANT SELECT ON auth.identities TO authenticated';
    END IF;
    
    -- Fix refresh_tokens permissions if the table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'auth' AND table_name = 'refresh_tokens'
    ) THEN
        EXECUTE 'GRANT SELECT ON auth.refresh_tokens TO authenticated';
    END IF;
END $$;

-- Create a helper function to check auth schema compatibility
-- This doesn't modify any existing functions, it just adds a new one
CREATE OR REPLACE FUNCTION check_auth_schema_health()
RETURNS jsonb AS $$
DECLARE
    result jsonb;
    has_providers boolean;
BEGIN
    -- Check if providers column exists
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'providers'
    ) INTO has_providers;

    -- Check for critical tables
    SELECT jsonb_build_object(
        'auth_users_exists', EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'auth' AND table_name = 'users'
        ),
        'auth_identities_exists', EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'auth' AND table_name = 'identities'
        ),
        'null_aud_count', (
            SELECT COUNT(*) FROM auth.users WHERE aud IS NULL
        ),
        'null_role_count', (
            SELECT COUNT(*) FROM auth.users WHERE role IS NULL
        ),
        'has_providers_column', has_providers
    ) INTO result;
    
    -- Only check providers if the column exists
    IF has_providers THEN
        result := result || jsonb_build_object(
            'null_providers_count', (
                SELECT COUNT(*) FROM auth.users WHERE providers IS NULL OR providers = '{}'
            )
        );
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant usage to allow checking schema health
GRANT EXECUTE ON FUNCTION check_auth_schema_health TO authenticated;
GRANT EXECUTE ON FUNCTION check_auth_schema_health TO anon;

-- Add helpful comment
COMMENT ON FUNCTION check_auth_schema_health IS 'Utility function to check auth schema health without modifying existing structure';

COMMIT; 