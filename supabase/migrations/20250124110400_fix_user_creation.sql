-- Drop existing user creation function
DROP FUNCTION IF EXISTS create_user_with_username(text, text, text) CASCADE;

-- Create improved user creation function
CREATE OR REPLACE FUNCTION create_user_with_username(
  p_username text,
  p_password text,
  p_role text DEFAULT 'user'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create users';
  END IF;

  -- Validate username
  IF NOT (p_username ~ '^[a-zA-Z0-9_-]{3,20}$') THEN
    RAISE EXCEPTION 'Invalid username. Use 3-20 characters, letters, numbers, underscore or hyphen only.';
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'merchant', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, merchant, or user';
  END IF;

  -- Check if username exists
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = p_username || '@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  -- Create user in auth.users
  v_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_username || '@merchant.local',
    crypt(p_password, gen_salt('bf')),
    now(),  -- Auto-confirm email
    now(),  -- Auto-confirm account
    jsonb_build_object(
      'provider', 'email',
      'providers', array['email'],
      'username', p_username,
      'role', p_role
    ),
    jsonb_build_object(
      'username', p_username,
      'role', p_role
    ),
    'authenticated'
  );

  -- Create user profile with role
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, p_role);

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to link collection to user
CREATE OR REPLACE FUNCTION link_collection_to_user(
  p_collection_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can link collections';
  END IF;

  -- Verify collection exists
  IF NOT EXISTS (SELECT 1 FROM collections WHERE id = p_collection_id) THEN
    RAISE EXCEPTION 'Collection does not exist';
  END IF;

  -- Verify user exists and is a merchant
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = p_user_id AND role IN ('admin', 'merchant')
  ) THEN
    RAISE EXCEPTION 'User does not exist or is not a merchant';
  END IF;

  -- Create collection access
  INSERT INTO collection_access (collection_id, user_id, granted_by)
  VALUES (p_collection_id, p_user_id, auth.uid())
  ON CONFLICT (collection_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION link_collection_to_user(uuid, uuid) TO authenticated; 