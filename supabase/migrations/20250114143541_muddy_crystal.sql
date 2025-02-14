-- Update admin420's metadata and role
UPDATE auth.users
SET 
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'role', 'supabase_admin',
    'is_admin', true
  ),
  raw_user_meta_data = jsonb_build_object(
    'role', 'supabase_admin',
    'is_admin', true
  ),
  role = 'supabase_admin'
WHERE email = 'admin420@merchant.local';

-- Grant admin420 all necessary permissions
DO $$ 
DECLARE
  admin_id uuid;
BEGIN
  -- Get admin420's user ID
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found';
  END IF;

  -- Grant all permissions
  GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
  GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
  
  GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO authenticated;
  GRANT ALL ON ALL FUNCTIONS IN SCHEMA storage TO authenticated;
  
  GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticated;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO authenticated;
  GRANT ALL ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;
END $$;