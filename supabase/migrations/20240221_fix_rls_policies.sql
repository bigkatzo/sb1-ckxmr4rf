-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.user_profiles;

-- Create policies for user_profiles table
-- 1. Users can view their own profile (regardless of role)
CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Service role can manage all profiles (needed for triggers)
CREATE POLICY "Service role can manage all profiles"
ON public.user_profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. Authenticated users can view merchant profiles (for product pages)
CREATE POLICY "Authenticated users can view merchant profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (role = 'merchant'::user_role AND id != auth.uid());

-- 5. Authenticator role can manage profiles (needed for registration)
CREATE POLICY "Authenticator can manage profiles"
ON public.user_profiles
FOR ALL
TO authenticator
USING (true)
WITH CHECK (true);

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