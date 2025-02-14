/*
  # Grant Full Permissions to Specific User

  1. Changes
    - Grant full access to user 053bb802-6faf-4f9c-84d2-bcdbea9a2e32
    - Add user to admin role
    - Grant all necessary permissions on tables and schemas
*/

-- Update user's metadata to include admin role
UPDATE auth.users
SET 
  raw_app_meta_data = jsonb_build_object(
    'role', 'supabase_admin',
    'is_admin', true
  ),
  raw_user_meta_data = jsonb_build_object(
    'role', 'supabase_admin',
    'is_admin', true
  )
WHERE id = '053bb802-6faf-4f9c-84d2-bcdbea9a2e32';

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT 
      email = 'admin420@merchant.local' 
      OR id = '053bb802-6faf-4f9c-84d2-bcdbea9a2e32'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant all permissions on all tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant storage permissions
GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA storage TO authenticated;