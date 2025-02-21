-- Drop ALL existing policies
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

-- Verify final state
DO $$
DECLARE
    policy_count int;
BEGIN
    -- Count policies
    SELECT COUNT(*)
    INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'user_profiles';

    RAISE NOTICE 'Found % policies on user_profiles table', policy_count;

    -- List all policies
    FOR pol IN (
        SELECT policyname, permissive, roles, cmd
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
        ORDER BY policyname
    ) LOOP
        RAISE NOTICE 'Active Policy: % (% % for %)', 
            pol.policyname, 
            pol.permissive, 
            pol.cmd,
            pol.roles;
    END LOOP;

    -- Verify permissions
    IF EXISTS (
        SELECT 1
        FROM information_schema.role_table_grants
        WHERE table_name = 'user_profiles'
        AND grantee = 'authenticated'
        AND privilege_type IN ('SELECT', 'UPDATE')
    ) THEN
        RAISE NOTICE 'Authenticated role has required permissions';
    ELSE
        RAISE WARNING 'Authenticated role missing permissions';
    END IF;

    -- Verify RLS is enabled
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'user_profiles'
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS is enabled on user_profiles';
    ELSE
        RAISE WARNING 'RLS is NOT enabled on user_profiles';
    END IF;
END $$; 