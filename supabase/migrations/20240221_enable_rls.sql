-- Enable Row Level Security for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
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
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname);
    END LOOP;
END $$;

-- Create policies for user_profiles table
-- 1. Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Users can update their own profile (excluding role changes)
CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id 
    AND (OLD.role = NEW.role OR auth.is_admin()) -- Only admins can change roles
);

-- 3. System role for profile creation via trigger
CREATE POLICY "System can create user profiles"
ON public.user_profiles
FOR INSERT
TO authenticator
WITH CHECK (true);

-- 4. Merchants can be viewed by authenticated users (for product pages)
CREATE POLICY "View merchant profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (role = 'merchant'::user_role);

-- 5. Admin full access policy
CREATE POLICY "Admins manage all profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (auth.is_admin())
WITH CHECK (auth.is_admin());

-- Grant minimal necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO authenticator; -- For profile creation

-- Verify RLS is enabled and policies are in place
DO $$
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
    ELSE
        RAISE WARNING 'No policies found for user_profiles';
    END IF;
END $$; 