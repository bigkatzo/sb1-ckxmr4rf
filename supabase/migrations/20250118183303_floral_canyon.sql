-- Drop existing policies and functions first
DO $$ BEGIN
  DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
  DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'merchant', 'user')) DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create super simple admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Direct email check without any dependencies
  RETURN NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create maximally permissive policies for user_profiles
CREATE POLICY "user_profiles_policy"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (true)  -- Allow all reads
  WITH CHECK (true);  -- Allow all writes

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS update_user_profile_timestamp ON user_profiles;
DROP FUNCTION IF EXISTS update_user_profile_updated_at();

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_profile_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profile_timestamp
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile_updated_at();

-- Ensure admin420 exists with correct role and metadata
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get or create admin420
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

  IF v_admin_id IS NULL THEN
    -- Create admin420 if doesn't exist
    INSERT INTO auth.users (
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      role
    )
    VALUES (
      'admin420@merchant.local',
      crypt('NeverSt0pClickin!', gen_salt('bf')),
      now(),
      jsonb_build_object(
        'provider', 'username',
        'providers', array['username'],
        'username', 'admin420'
      ),
      jsonb_build_object(
        'username', 'admin420'
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
        'username', 'admin420'
      ),
      raw_user_meta_data = jsonb_build_object(
        'username', 'admin420'
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

-- Grant necessary permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_profile_updated_at() TO authenticated;