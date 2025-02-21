-- First, disable RLS temporarily to ensure clean policy setup
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert for auth" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticator can manage profiles" ON public.user_profiles;

-- Grant necessary permissions first
GRANT USAGE ON SCHEMA public TO postgres, authenticator, authenticated, anon;
GRANT ALL ON public.user_profiles TO postgres, authenticator, service_role;
GRANT SELECT, UPDATE, INSERT ON public.user_profiles TO authenticated;

-- Create comprehensive set of policies

-- 1. Service role bypass (needed for Supabase functions and admin operations)
CREATE POLICY "service_role_bypass"
ON public.user_profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Authenticator role bypass (needed for auth triggers and initial setup)
CREATE POLICY "authenticator_bypass"
ON public.user_profiles
FOR ALL
TO authenticator
USING (true)
WITH CHECK (true);

-- 3. Users can view their own profile (essential for login flow)
CREATE POLICY "users_can_view_own_profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 4. Users can update their own profile
CREATE POLICY "users_can_update_own_profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. Users can insert their own profile
CREATE POLICY "users_can_insert_own_profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 6. Users can view merchant profiles (needed for product pages)
CREATE POLICY "users_can_view_merchant_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (role = 'merchant'::user_role AND id != auth.uid());

-- Re-enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Verify setup
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Check if RLS is enabled
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS is enabled for user_profiles';
    ELSE
        RAISE WARNING 'RLS is NOT enabled for user_profiles';
    END IF;

    -- Check policies
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
    ) THEN
        RAISE NOTICE 'Policies are configured for user_profiles';
        
        -- List all policies with correct column names
        FOR r IN
            SELECT policyname, cmd as command_type, roles::text as role_list
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'user_profiles'
        LOOP
            RAISE NOTICE 'Policy: % (% for %)', r.policyname, r.command_type, r.role_list;
        END LOOP;
    ELSE
        RAISE WARNING 'No policies found for user_profiles';
    END IF;

    -- Verify permissions
    RAISE NOTICE 'Verifying role permissions...';
    
    -- Test authenticator permissions
    IF EXISTS (
        SELECT 1 FROM information_schema.role_table_grants 
        WHERE table_name = 'user_profiles' 
        AND grantee = 'authenticator'
        AND privilege_type = 'INSERT'
    ) THEN
        RAISE NOTICE 'Authenticator role has required permissions';
    ELSE
        RAISE WARNING 'Authenticator role may be missing required permissions';
    END IF;

    -- Test authenticated user permissions
    IF EXISTS (
        SELECT 1 FROM information_schema.role_table_grants 
        WHERE table_name = 'user_profiles' 
        AND grantee = 'authenticated'
        AND privilege_type IN ('SELECT', 'UPDATE', 'INSERT')
    ) THEN
        RAISE NOTICE 'Authenticated users have required permissions';
    ELSE
        RAISE WARNING 'Authenticated users may be missing required permissions';
    END IF;
END $$; 