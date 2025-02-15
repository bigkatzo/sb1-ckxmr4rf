-- Ensure admin420 exists and has correct profile
DO $$ 
DECLARE
  v_user_id uuid;
BEGIN
  -- Get or create admin420 user
  INSERT INTO auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    role,
    raw_app_meta_data,
    raw_user_meta_data
  )
  VALUES (
    'admin420@merchant.local',
    crypt('admin420', gen_salt('bf')),
    now(),
    'authenticated',
    jsonb_build_object('role', 'admin'),
    jsonb_build_object('role', 'admin')
  )
  ON CONFLICT (email) DO UPDATE
  SET 
    raw_app_meta_data = jsonb_build_object('role', 'admin'),
    raw_user_meta_data = jsonb_build_object('role', 'admin'),
    role = 'authenticated'
  RETURNING id INTO v_user_id;

  -- Ensure admin profile exists
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin';

  -- Grant necessary permissions
  GRANT USAGE ON SCHEMA auth TO authenticated;
  GRANT ALL ON user_profiles TO authenticated;
END $$; 