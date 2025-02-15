-- Ensure email is confirmed
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmed_at = COALESCE(confirmed_at, now()),
    last_sign_in_at = NULL,
    raw_app_meta_data = jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email'],
      'role', 'merchant'
    ),
    raw_user_meta_data = jsonb_build_object(
      'role', 'merchant'
    ),
    role = 'authenticated'
WHERE email = 'supauser@merchant.local';

-- Ensure user has a profile
INSERT INTO user_profiles (id, role)
SELECT id, 'merchant'
FROM auth.users
WHERE email = 'supauser@merchant.local'
ON CONFLICT (id) DO UPDATE
SET role = 'merchant';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure RLS policies are properly set
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile"
    ON user_profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    ); 