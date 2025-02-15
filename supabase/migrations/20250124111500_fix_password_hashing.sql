-- Drop all custom auth functions
DO $$ BEGIN
  DROP FUNCTION IF EXISTS hash_password(text) CASCADE;
  DROP FUNCTION IF EXISTS verify_password(text, text) CASCADE;
  DROP FUNCTION IF EXISTS auth.reset_user_password(text, text) CASCADE;
  DROP FUNCTION IF EXISTS create_user_with_username(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS reset_user_password(text, text) CASCADE;
  DROP FUNCTION IF EXISTS ensure_user_exists(text, text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS create_merchant_user(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS create_exact_copy_user(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS create_auth_user(text, text, text) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Remove any custom triggers
DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
DROP TRIGGER IF EXISTS sync_user_profile_trigger ON auth.users;
DROP TRIGGER IF EXISTS handle_auth_user_trigger ON auth.users;

-- Keep only the essential RLS policies for user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;

-- Create simple RLS policy for user_profiles
CREATE POLICY "users can view own profile"
ON user_profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Standardize auth settings for all users
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
  aud = 'authenticated',
  updated_at = now()
WHERE email LIKE '%@merchant.local';

-- Ensure all users have proper profiles
INSERT INTO user_profiles (id, role)
SELECT 
  id,
  CASE 
    WHEN email = 'admin420@merchant.local' THEN 'admin'
    ELSE 'merchant'
  END as role
FROM auth.users
WHERE email LIKE '%@merchant.local'
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO authenticated, anon; 