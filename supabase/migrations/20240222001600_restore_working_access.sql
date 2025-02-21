-- First, drop all existing policies to start fresh
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN (
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
    )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create the most permissive policy first (this was working before)
CREATE POLICY "Enable all access to user_profiles"
ON user_profiles
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create policy for system operations
CREATE POLICY "System can create user profiles"
ON user_profiles
FOR INSERT
TO postgres
WITH CHECK (true);

-- Create function to check email availability
CREATE OR REPLACE FUNCTION public.check_email_availability(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 
        FROM public.user_profiles 
        WHERE email = p_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, authenticated, anon;
GRANT ALL ON user_profiles TO postgres;
GRANT ALL ON user_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_availability(TEXT) TO anon, authenticated;

-- Verify setup
DO $$
BEGIN
    -- Check if the function exists and has proper permissions
    IF EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'check_email_availability' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE NOTICE 'Function check_email_availability is configured';
    ELSE
        RAISE WARNING 'Function check_email_availability is missing';
    END IF;

    -- Check if the main access policy exists
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
        AND policyname = 'Enable all access to user_profiles'
    ) THEN
        RAISE NOTICE 'Main access policy is configured';
    ELSE
        RAISE WARNING 'Main access policy is missing';
    END IF;

    -- Verify RLS is enabled but with permissive policy
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS is enabled on user_profiles (with permissive policy)';
    ELSE
        RAISE WARNING 'RLS is NOT enabled on user_profiles';
    END IF;
END $$; 