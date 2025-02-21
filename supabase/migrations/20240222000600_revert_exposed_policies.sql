-- Revert overly permissive policies
DROP POLICY IF EXISTS "Anyone can check email availability" ON user_profiles;
DROP VIEW IF EXISTS public.user_emails;

-- Revoke broad permissions
REVOKE SELECT ON user_profiles FROM anon;
REVOKE SELECT ON user_profiles FROM authenticated;

-- Restore original RLS policies if they don't exist
DO $$
BEGIN
    -- Check if user view policy exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
        AND policyname = 'Users can view their own profile'
    ) THEN
        CREATE POLICY "Users can view their own profile"
        ON user_profiles FOR SELECT
        TO authenticated
        USING (auth.uid() = id);
    END IF;

    -- Check if user update policy exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
        AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile"
        ON user_profiles FOR UPDATE
        TO authenticated
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;

    -- Check if admin view policy exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
        AND policyname = 'Admins can view all profiles'
    ) THEN
        CREATE POLICY "Admins can view all profiles"
        ON user_profiles FOR SELECT
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM user_profiles up
                WHERE up.id = auth.uid() AND up.role = 'admin'
            )
        );
    END IF;

    -- Check if admin update policy exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
        AND policyname = 'Admins can update all profiles'
    ) THEN
        CREATE POLICY "Admins can update all profiles"
        ON user_profiles FOR UPDATE
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM user_profiles up
                WHERE up.id = auth.uid() AND up.role = 'admin'
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM user_profiles up
                WHERE up.id = auth.uid() AND up.role = 'admin'
            )
        );
    END IF;
END $$;

-- Verify RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Grant minimal required permissions
GRANT SELECT, UPDATE (role, email) ON user_profiles TO authenticated;

-- Verify function-based email check still exists and has proper permissions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_proc 
        WHERE proname = 'check_email_availability' 
        AND pronamespace = 'public'::regnamespace
    ) THEN
        RAISE EXCEPTION 'Email check function is missing - please run the function creation migration first';
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.routine_privileges 
        WHERE routine_name = 'check_email_availability' 
        AND grantee IN ('anon', 'authenticated')
    ) THEN
        -- Ensure function permissions are granted
        GRANT EXECUTE ON FUNCTION public.check_email_availability(TEXT) TO anon, authenticated;
    END IF;
END $$; 