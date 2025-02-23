-- Grant superuser privileges to admin420
UPDATE auth.users
SET 
  is_super_admin = true,
  raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
    'is_super_admin', true,
    'is_owner', true
  )
WHERE email = 'admin420@merchant.local';

-- Ensure admin420 has all necessary permissions
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get admin420's user ID
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

  IF v_admin_id IS NOT NULL THEN
    -- Update user profile
    INSERT INTO user_profiles (id, role, created_at, updated_at)
    VALUES (v_admin_id, 'admin', now(), now())
    ON CONFLICT (id) DO UPDATE 
    SET 
      role = 'admin',
      updated_at = now();

    -- Update user metadata
    UPDATE auth.users
    SET 
      raw_app_meta_data = jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email'],
        'role', 'admin',
        'is_super_admin', true,
        'is_owner', true
      ),
      raw_user_meta_data = jsonb_build_object(
        'email_verified', true,
        'role', 'admin',
        'is_super_admin', true
      ),
      role = 'service_role',  -- Give service_role access
      aud = 'authenticated',
      updated_at = now()
    WHERE id = v_admin_id;
  END IF;
END $$;

-- Create a function to check if user is super admin
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT EXISTS (
      SELECT 1 
      FROM auth.users 
      WHERE id = auth.uid() 
      AND is_super_admin = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the new function
GRANT EXECUTE ON FUNCTION auth.is_super_admin() TO authenticated;

-- Drop the old admin check function
DROP FUNCTION IF EXISTS auth.is_admin();

-- Create a proper role-based admin check
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Check if the current user has the admin role in the profiles table
  RETURN EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure we have a role column in profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'user';
  END IF;
END $$;

-- Create an index on the role column for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Update RLS policies to use role-based checks
CREATE OR REPLACE FUNCTION auth.is_merchant()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'merchant')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop any existing policies that might conflict
DROP POLICY IF EXISTS "collections_policy" ON collections;

-- Create new role-based policy
CREATE POLICY "collections_policy" ON collections
USING (
  -- Anyone can view collections
  true
)
WITH CHECK (
  -- Only admins and merchants can modify collections
  auth.is_merchant()
);

COMMENT ON FUNCTION auth.is_admin() IS 'Checks if the current user has admin role';
COMMENT ON FUNCTION auth.is_merchant() IS 'Checks if the current user has merchant or admin role'; 