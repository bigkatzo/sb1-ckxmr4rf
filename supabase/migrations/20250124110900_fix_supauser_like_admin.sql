-- Remove existing supauser
DELETE FROM auth.users 
WHERE email = 'supauser@merchant.local';

-- Create supauser following admin420 pattern
DO $$ 
DECLARE
  v_user_id uuid;
BEGIN
  -- Create supauser
  INSERT INTO auth.users (
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    'supauser@merchant.local',
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
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
  )
  RETURNING id INTO v_user_id;

  -- Ensure user profile exists
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, 'merchant')
  ON CONFLICT (id) DO UPDATE
  SET role = 'merchant';
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO authenticated; 