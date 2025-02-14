-- Drop existing merchant user if exists
DO $$ BEGIN
  DELETE FROM auth.users 
  WHERE email = 'merchant@merchant.local';
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create merchant user with proper credentials
INSERT INTO auth.users (
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  role
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'merchant@merchant.local',
  crypt('merchant123', gen_salt('bf')), -- Set password to: merchant123
  now(),
  jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', 'merchant',
    'role', 'merchant'
  ),
  jsonb_build_object(
    'username', 'merchant',
    'role', 'merchant'
  ),
  'authenticated'
);

-- Ensure merchant profile exists
INSERT INTO user_profiles (id, role)
SELECT id, 'merchant'
FROM auth.users 
WHERE email = 'merchant@merchant.local'
ON CONFLICT (id) DO UPDATE 
SET role = 'merchant';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT ALL ON user_profiles TO authenticated;