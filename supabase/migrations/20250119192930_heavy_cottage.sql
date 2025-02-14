-- Drop existing functions and policies
DO $$ BEGIN
  DROP FUNCTION IF EXISTS create_user_with_role(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS verify_merchant_access(uuid) CASCADE;
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.has_merchant_access() CASCADE;
  DROP POLICY IF EXISTS "merchant_dashboard_access" ON collections;
  DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
  DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create merchant access check function
CREATE OR REPLACE FUNCTION auth.has_merchant_access()
RETURNS boolean AS $$
BEGIN
  -- Check if user is admin first
  IF auth.is_admin() THEN
    RETURN true;
  END IF;

  -- Check if user has merchant role
  RETURN EXISTS (
    SELECT 1 FROM auth.users u
    LEFT JOIN user_profiles p ON p.id = u.id
    WHERE u.id = auth.uid()
    AND (
      p.role = 'merchant'
      OR u.raw_app_meta_data->>'role' = 'merchant'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create user with role
CREATE OR REPLACE FUNCTION create_user_with_role(
  p_email text,
  p_password text,
  p_role text DEFAULT 'user'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_username text;
  v_existing_id uuid;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_existing_id
  FROM auth.users
  WHERE email = p_email;

  -- If user exists, update their role and return their ID
  IF v_existing_id IS NOT NULL THEN
    -- Update metadata
    UPDATE auth.users
    SET 
      raw_app_meta_data = jsonb_build_object(
        'provider', 'username',
        'providers', array['username'],
        'username', split_part(p_email, '@', 1),
        'role', p_role
      ),
      raw_user_meta_data = jsonb_build_object(
        'username', split_part(p_email, '@', 1),
        'role', p_role
      )
    WHERE id = v_existing_id;

    -- Update profile
    INSERT INTO user_profiles (id, role)
    VALUES (v_existing_id, p_role)
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role;

    RETURN v_existing_id;
  END IF;

  -- Generate UUID for new user
  v_user_id := gen_random_uuid();
  
  -- Validate role
  IF p_role NOT IN ('admin', 'merchant', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, merchant, or user';
  END IF;

  -- Extract username from email
  v_username := split_part(p_email, '@', 1);

  -- Create user in auth.users first
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
      'username', v_username,
      'role', p_role
    ),
    jsonb_build_object(
      'username', v_username,
      'role', p_role
    ),
    'authenticated'
  );

  -- Create user profile
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, p_role);

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for merchant dashboard access
CREATE POLICY "merchant_dashboard_access"
  ON collections
  FOR ALL
  TO authenticated
  USING (
    -- Admin can do anything
    auth.is_admin()
    OR
    -- Merchants can access their collections
    (
      auth.has_merchant_access()
      AND user_id = auth.uid()
    )
  );

-- Create RLS policies for user_profiles
CREATE POLICY "users_read_own_profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR auth.is_admin());

CREATE POLICY "admin_manage_profiles"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Update existing admin420 if exists
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get existing admin420 ID
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

  IF v_admin_id IS NOT NULL THEN
    -- Update existing admin420
    UPDATE auth.users
    SET 
      raw_app_meta_data = jsonb_build_object(
        'provider', 'username',
        'providers', array['username'],
        'username', 'admin420',
        'role', 'admin'
      ),
      raw_user_meta_data = jsonb_build_object(
        'username', 'admin420',
        'role', 'admin'
      )
    WHERE id = v_admin_id;

    -- Update profile
    INSERT INTO user_profiles (id, role)
    VALUES (v_admin_id, 'admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
  ELSE
    -- Create new admin420
    SELECT create_user_with_role('admin420@merchant.local', 'NeverSt0pClickin!', 'admin')
    INTO v_admin_id;
  END IF;
END $$;

-- Create test merchant account if doesn't exist
DO $$ 
DECLARE
  v_merchant_id uuid;
BEGIN
  -- Create merchant user if doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = 'merchant@merchant.local'
  ) THEN
    SELECT create_user_with_role('merchant@merchant.local', 'merchant123', 'merchant')
    INTO v_merchant_id;
  END IF;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_role(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_merchant_access() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;