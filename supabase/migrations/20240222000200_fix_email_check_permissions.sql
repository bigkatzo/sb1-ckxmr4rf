-- Drop any existing policy
DROP POLICY IF EXISTS "Anyone can check email availability" ON user_profiles;

-- Create policy to allow email checking for anyone
CREATE POLICY "Anyone can check email availability"
ON user_profiles
FOR SELECT
TO PUBLIC
USING (true)
WITH CHECK (true);

-- Grant necessary permission
GRANT SELECT (email) ON user_profiles TO anon; 