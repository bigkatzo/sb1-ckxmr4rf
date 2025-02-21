-- First, drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow trigger to create profiles" ON user_profiles;

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own profile"
ON user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create policies for admin access
CREATE POLICY "Admins can view all profiles"
ON user_profiles
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM user_profiles up 
        WHERE up.id = auth.uid() 
        AND up.role = 'admin'::user_role
    )
);

CREATE POLICY "Admins can update all profiles"
ON user_profiles
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM user_profiles up 
        WHERE up.id = auth.uid() 
        AND up.role = 'admin'::user_role
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM user_profiles up 
        WHERE up.id = auth.uid() 
        AND up.role = 'admin'::user_role
    )
);

-- Create policy for profile creation via trigger
CREATE POLICY "System can create user profiles"
ON user_profiles
FOR INSERT
TO postgres
WITH CHECK (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO postgres;

-- Verify policies
DO $$
DECLARE
    policy_count int;
BEGIN
    SELECT COUNT(*)
    INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'user_profiles';

    RAISE NOTICE 'Found % policies on user_profiles table', policy_count;

    -- List all policies
    FOR policy IN (
        SELECT policyname, permissive, roles, cmd
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
    ) LOOP
        RAISE NOTICE 'Policy: % (% % for %)', 
            policy.policyname, 
            policy.permissive, 
            policy.cmd,
            policy.roles;
    END LOOP;
END $$;

-- Verify permissions
DO $$
BEGIN
    -- Check authenticated role permissions
    IF EXISTS (
        SELECT 1
        FROM information_schema.role_table_grants
        WHERE table_name = 'user_profiles'
        AND grantee = 'authenticated'
        AND privilege_type IN ('SELECT', 'UPDATE')
    ) THEN
        RAISE NOTICE 'Authenticated role has proper permissions';
    ELSE
        RAISE WARNING 'Authenticated role may be missing required permissions';
    END IF;

    -- Check postgres role permissions
    IF EXISTS (
        SELECT 1
        FROM information_schema.role_table_grants
        WHERE table_name = 'user_profiles'
        AND grantee = 'postgres'
        AND privilege_type = 'INSERT'
    ) THEN
        RAISE NOTICE 'Postgres role has INSERT permission';
    ELSE
        RAISE WARNING 'Postgres role may be missing INSERT permission';
    END IF;
END $$; 