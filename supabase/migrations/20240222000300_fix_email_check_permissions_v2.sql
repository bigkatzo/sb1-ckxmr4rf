-- Drop any existing policy
DROP POLICY IF EXISTS "Anyone can check email availability" ON user_profiles;

-- Create policy to allow email checking for anyone
CREATE POLICY "Anyone can check email availability"
ON user_profiles
FOR SELECT
TO PUBLIC
USING (true);

-- Grant necessary permissions to both anon and authenticated roles
GRANT SELECT ON user_profiles TO anon, authenticated;

-- Verify RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY; 