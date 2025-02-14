-- Drop existing functions first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS create_user_with_role(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS validate_user_credentials(text, text) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

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
BEGIN
  -- Generate UUID for new user
  v_user_id := gen_random_uuid();
  
  -- Validate role
  IF p_role NOT IN ('admin', 'merchant', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, merchant, or user';
  END IF;

  -- Extract username from email
  v_username := split_part(p_email, '@', 1);

  -- Create user in auth.users
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

-- Create function to validate user credentials
CREATE OR REPLACE FUNCTION validate_user_credentials(
  p_email text,
  p_password text
)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  has_collections boolean,
  has_access boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(p.role, 'user') as role,
    EXISTS (
      SELECT 1 FROM collections c WHERE c.user_id = u.id
    ) as has_collections,
    EXISTS (
      SELECT 1 FROM collection_access ca WHERE ca.user_id = u.id
    ) as has_access
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.email = p_email
  AND u.encrypted_password = crypt(p_password, u.encrypted_password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure admin420 exists with correct credentials
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Delete existing admin420 if exists
  DELETE FROM auth.users WHERE email = 'admin420@merchant.local';
  
  -- Create fresh admin420 account
  SELECT create_user_with_role(
    'admin420@merchant.local',
    'NeverSt0pClickin!',
    'admin'
  ) INTO v_admin_id;

  -- Double check admin profile exists
  INSERT INTO user_profiles (id, role)
  VALUES (v_admin_id, 'admin')
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin';
END $$;

-- Create test merchant account
DO $$
DECLARE
  v_merchant_id uuid;
BEGIN
  -- Create merchant user
  SELECT create_user_with_role(
    'merchant@merchant.local',
    'merchant123',
    'merchant'
  ) INTO v_merchant_id;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_role(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_user_credentials(text, text) TO authenticated;