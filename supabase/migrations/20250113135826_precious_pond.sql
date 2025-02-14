-- Drop any existing admin-related functions
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Create admin check function that only recognizes admin420
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT email = 'admin420@merchant.local'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant admin role to admin420
DO $$
BEGIN
  -- Update admin420 user's raw_app_meta_data to include admin role
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'role', 'supabase_admin',
    'username', 'admin420'
  )
  WHERE email = 'admin420@merchant.local';

  -- Update raw_user_meta_data as well
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_build_object(
    'username', 'admin420',
    'role', 'supabase_admin'
  )
  WHERE email = 'admin420@merchant.local';
END $$;

-- Ensure admin420 has all necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;