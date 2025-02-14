-- Drop existing functions first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.get_user_role() CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simplified admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Use direct email check with proper null handling
  RETURN NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user role
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  -- First check if user is admin420
  IF auth.is_admin() THEN
    RETURN 'admin';
  END IF;

  -- Get role from user_profiles with fallback
  SELECT role INTO v_role
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN COALESCE(v_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check database connection
CREATE OR REPLACE FUNCTION check_database_connection()
RETURNS boolean AS $$
BEGIN
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure admin420 has correct profile and metadata
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get admin420's user ID
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

  IF v_admin_id IS NULL THEN
    -- Create admin420 if doesn't exist
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
      'admin420@merchant.local',
      crypt('NeverSt0pClickin!', gen_salt('bf')),
      now(),
      jsonb_build_object(
        'provider', 'username',
        'providers', array['username'],
        'username', 'admin420',
        'role', 'admin'
      ),
      jsonb_build_object(
        'username', 'admin420',
        'role', 'admin'
      ),
      'authenticated'
    )
    RETURNING id INTO v_admin_id;
  ELSE
    -- Update existing admin420
    UPDATE auth.users
    SET 
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_app_meta_data = jsonb_build_object(
        'provider', 'username',
        'providers', array['username'],
        'username', 'admin420',
        'role', 'admin'
      ),
      raw_user_meta_data = jsonb_build_object(
        'username', 'admin420',
        'role', 'admin'
      ),
      role = 'authenticated'
    WHERE id = v_admin_id;
  END IF;

  -- Ensure admin profile exists
  INSERT INTO user_profiles (id, role)
  VALUES (v_admin_id, 'admin')
  ON CONFLICT (id) DO UPDATE 
  SET role = 'admin';
END $$;

-- Create RLS policy for user_profiles
DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
CREATE POLICY "user_profiles_policy"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (true)  -- Allow reading all profiles
  WITH CHECK (auth.is_admin());  -- Only admin can modify

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION check_database_connection() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;