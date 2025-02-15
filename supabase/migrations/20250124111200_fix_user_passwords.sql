-- Update passwords for test users
UPDATE auth.users
SET encrypted_password = crypt('password123', gen_salt('bf', 10))
WHERE email IN ('supauser@merchant.local', 'mike@merchant.local');

-- Ensure email confirmation and other settings
UPDATE auth.users
SET 
  email_confirmed_at = now(),
  confirmed_at = now(),
  last_sign_in_at = NULL,
  raw_app_meta_data = jsonb_build_object(
    'provider', 'email',
    'providers', array['email']
  ),
  raw_user_meta_data = jsonb_build_object(),
  role = 'authenticated',
  aud = 'authenticated'
WHERE email IN ('supauser@merchant.local', 'mike@merchant.local');

-- Ensure profiles exist
INSERT INTO user_profiles (id, role)
SELECT id, 'merchant'
FROM auth.users
WHERE email IN ('supauser@merchant.local', 'mike@merchant.local')
ON CONFLICT (id) DO UPDATE
SET role = 'merchant';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO authenticated, anon; 