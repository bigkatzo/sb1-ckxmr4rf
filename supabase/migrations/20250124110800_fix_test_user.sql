-- Remove existing test user
DELETE FROM auth.users WHERE email = 'supauser@merchant.local';

-- Insert test user directly
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
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
  deleted_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'supauser@merchant.local',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NULL,
  '',
  NULL,
  '',
  NULL,
  '',
  '',
  NULL,
  NULL,
  '{"provider": "email", "providers": ["email"], "role": "merchant"}'::jsonb,
  '{"role": "merchant"}'::jsonb,
  FALSE,
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NULL,
  NOW(),
  '',
  0,
  NULL,
  '',
  NULL,
  FALSE,
  NULL
);

-- Create user profile for the test user
INSERT INTO user_profiles (id, role)
SELECT id, 'merchant'
FROM auth.users
WHERE email = 'supauser@merchant.local'
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, authenticated, anon; 