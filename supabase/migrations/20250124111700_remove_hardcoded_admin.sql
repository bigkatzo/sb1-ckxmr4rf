-- Remove all hardcoded users including admin
DELETE FROM auth.users 
WHERE email LIKE '%@merchant.local';

-- Drop any remaining functions that reference hardcoded admin
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create clean admin check function that only uses role
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated, anon; 