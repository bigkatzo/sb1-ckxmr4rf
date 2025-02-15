-- Remove all test users
DELETE FROM auth.users 
WHERE email LIKE '%@merchant.local'
AND email != 'admin420@merchant.local';  -- Keep only the admin

-- Drop all custom user creation functions
DO $$ BEGIN
  DROP FUNCTION IF EXISTS create_merchant_user(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS create_exact_copy_user(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS create_auth_user(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS create_user_with_username(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS create_user_with_role(text, text, text) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Update admin user to use Supabase auth
UPDATE auth.users
SET 
  email_confirmed_at = now(),
  confirmed_at = now(),
  last_sign_in_at = NULL,
  raw_app_meta_data = jsonb_build_object(
    'provider', 'email',
    'providers', array['email'],
    'role', 'admin'
  ),
  raw_user_meta_data = jsonb_build_object(
    'role', 'admin'
  ),
  role = 'authenticated',
  aud = 'authenticated',
  updated_at = now()
WHERE email = 'admin420@merchant.local';

-- Ensure admin profile exists
INSERT INTO user_profiles (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin420@merchant.local'
ON CONFLICT (id) DO UPDATE
SET role = 'admin';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticated, anon; 