-- First, store admin420's settings
CREATE OR REPLACE FUNCTION get_admin_settings()
RETURNS TABLE (
  instance_id uuid,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  role text,
  aud text,
  encrypted_password text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.instance_id,
    a.email_confirmed_at,
    a.raw_app_meta_data,
    a.raw_user_meta_data,
    a.role,
    a.aud,
    a.encrypted_password
  FROM auth.users a
  WHERE email = 'admin420@merchant.local'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove existing test users
DELETE FROM auth.users 
WHERE email IN ('supauser@merchant.local', 'mike@merchant.local');

-- Create function to properly create users
CREATE OR REPLACE FUNCTION create_merchant_user(
  p_email text,
  p_password text,
  p_username text
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_admin_settings record;
BEGIN
  -- Get admin settings as template
  SELECT * INTO v_admin_settings FROM get_admin_settings();
  
  -- Create new user with admin pattern
  INSERT INTO auth.users (
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  )
  VALUES (
    v_admin_settings.instance_id,
    p_email,
    crypt(p_password, gen_salt('bf')),
    v_admin_settings.email_confirmed_at,
    v_admin_settings.email_confirmed_at,
    NULL,
    jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
      'username', p_username,
      'role', 'merchant'
    ),
    jsonb_build_object(
      'username', p_username,
      'role', 'merchant'
    ),
    v_admin_settings.role,
    v_admin_settings.aud,
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  -- Create user profile
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, 'merchant')
  ON CONFLICT (id) DO UPDATE
  SET role = 'merchant';

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate test users using admin pattern
SELECT create_merchant_user('supauser@merchant.local', 'password123', 'supauser');
SELECT create_merchant_user('mike@merchant.local', 'password123', 'mike');

-- Drop the helper function
DROP FUNCTION IF EXISTS get_admin_settings();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION create_merchant_user(text, text, text) TO authenticated, anon; 