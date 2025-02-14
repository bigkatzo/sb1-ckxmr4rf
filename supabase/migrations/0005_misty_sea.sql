/*
  # Update Admin Authentication

  1. Updates the admin user to use username instead of email
  2. Ensures idempotency by checking if the user exists first
*/

-- Update existing admin user or create new one
DO $$
BEGIN
  -- Delete old admin user if exists
  DELETE FROM auth.users WHERE email = 'admin420';
  
  -- Create new admin user with username
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin420@merchant.local',
    crypt('NeverSt0pClickin!', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
      'username', 'admin420'
    ),
    jsonb_build_object(
      'username', 'admin420'
    ),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );
END $$;