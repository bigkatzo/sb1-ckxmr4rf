-- Remove the existing user
DELETE FROM auth.users
WHERE email = 'supauser@merchant.local';

-- Create the user with proper settings
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_password text := 'password123'; -- Replace with the actual password you're using
BEGIN
  -- Create user with proper auth settings
  INSERT INTO auth.users (
    id,
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
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'supauser@merchant.local',
    crypt(v_password, gen_salt('bf')),
    now(),
    now(),
    NULL,
    jsonb_build_object(
      'provider', 'email',
      'providers', array['email'],
      'username', 'supauser',
      'role', 'merchant'
    ),
    jsonb_build_object(
      'username', 'supauser',
      'role', 'merchant'
    ),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- Create user profile
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, 'merchant');

  -- Log the creation for verification
  RAISE NOTICE 'Created user with ID: %', v_user_id;
END $$; 