-- First, remove existing test users
DELETE FROM auth.users 
WHERE email IN ('supauser@merchant.local', 'mike@merchant.local');

-- Create function to exactly copy admin's settings
CREATE OR REPLACE FUNCTION create_exact_copy_user(
  p_email text,
  p_password text,
  p_username text
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_admin_record auth.users%ROWTYPE;
BEGIN
  -- Get admin's record as template
  SELECT * INTO v_admin_record 
  FROM auth.users 
  WHERE email = 'admin420@merchant.local';

  -- Create new user with exact same settings
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    confirmed_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    role,
    aud
  )
  VALUES (
    v_user_id,
    v_admin_record.instance_id,
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    v_admin_record.confirmation_token,
    v_admin_record.confirmation_sent_at,
    v_admin_record.recovery_token,
    v_admin_record.recovery_sent_at,
    v_admin_record.email_change_token_new,
    v_admin_record.email_change,
    v_admin_record.email_change_sent_at,
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
    false,
    now(),
    now(),
    v_admin_record.phone,
    v_admin_record.phone_confirmed_at,
    v_admin_record.phone_change,
    v_admin_record.phone_change_token,
    v_admin_record.phone_change_sent_at,
    now(),
    v_admin_record.email_change_token_current,
    v_admin_record.email_change_confirm_status,
    v_admin_record.banned_until,
    v_admin_record.reauthentication_token,
    v_admin_record.reauthentication_sent_at,
    v_admin_record.is_sso_user,
    v_admin_record.deleted_at,
    'authenticated',
    'authenticated'
  );

  -- Create user profile
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, 'merchant')
  ON CONFLICT (id) DO UPDATE
  SET role = 'merchant';

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create test users using exact copy function
SELECT create_exact_copy_user('supauser@merchant.local', 'password123', 'supauser');
SELECT create_exact_copy_user('mike@merchant.local', 'password123', 'mike');

-- Drop the function
DROP FUNCTION create_exact_copy_user(text, text, text);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO authenticated, anon; 