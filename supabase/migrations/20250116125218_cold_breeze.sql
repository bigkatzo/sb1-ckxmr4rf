-- Update admin420's role and metadata
UPDATE auth.users
SET 
  role = 'supabase_admin',
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'role', 'supabase_admin',
    'is_admin', true
  ),
  raw_user_meta_data = jsonb_build_object(
    'role', 'supabase_admin',
    'is_admin', true
  )
WHERE email = 'admin420@merchant.local';

-- Grant necessary permissions to supabase_admin role
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO supabase_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_admin;

-- Update admin check function to be more permissive
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT 
      email = 'admin420@merchant.local' 
      OR role = 'supabase_admin'
      OR raw_app_meta_data->>'role' = 'supabase_admin'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure admin420 has admin profile
INSERT INTO user_profiles (id, role)
SELECT id, 'admin'
FROM auth.users 
WHERE email = 'admin420@merchant.local'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin';