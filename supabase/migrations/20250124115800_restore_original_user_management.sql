-- Drop existing functions
DROP FUNCTION IF EXISTS list_users() CASCADE;
DROP FUNCTION IF EXISTS create_user_with_username(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS manage_user_role(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS change_user_password(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS delete_user(uuid) CASCADE;

-- Create list_users function
CREATE OR REPLACE FUNCTION list_users()
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  created_at timestamptz
) AS $$
BEGIN
  -- Only allow admin420 to list users
  IF NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') != 'admin420@merchant.local' THEN
    RAISE EXCEPTION 'Only admin420 can list users';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(p.role, 'user')::text,
    u.created_at
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.email != 'admin420@merchant.local'
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user management functions
CREATE OR REPLACE FUNCTION create_user_with_username(
  p_username text,
  p_password text,
  p_role text DEFAULT 'user'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Only allow admin420 to create users
  IF NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') != 'admin420@merchant.local' THEN
    RAISE EXCEPTION 'Only admin420 can create users';
  END IF;

  -- Create user
  INSERT INTO auth.users (
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_username || '@merchant.local',
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('role', p_role),
    jsonb_build_object('role', p_role),
    'authenticated',
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  -- Create profile
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, p_role);

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to manage user roles
CREATE OR REPLACE FUNCTION manage_user_role(
  p_user_id uuid,
  p_role text
)
RETURNS void AS $$
BEGIN
  -- Only allow admin420 to manage roles
  IF NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') != 'admin420@merchant.local' THEN
    RAISE EXCEPTION 'Only admin420 can manage user roles';
  END IF;

  -- Update profile
  UPDATE user_profiles
  SET role = p_role
  WHERE id = p_user_id;

  -- Update user metadata
  UPDATE auth.users
  SET 
    raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', p_role),
    raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', p_role),
    updated_at = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to change user password
CREATE OR REPLACE FUNCTION change_user_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS void AS $$
BEGIN
  -- Only allow admin420 to change passwords
  IF NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') != 'admin420@merchant.local' THEN
    RAISE EXCEPTION 'Only admin420 can change user passwords';
  END IF;

  UPDATE auth.users
  SET 
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to delete users
CREATE OR REPLACE FUNCTION delete_user(
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  -- Only allow admin420 to delete users
  IF NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') != 'admin420@merchant.local' THEN
    RAISE EXCEPTION 'Only admin420 can delete users';
  END IF;

  -- Delete user profile
  DELETE FROM user_profiles WHERE id = p_user_id;
  
  -- Delete auth user
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION change_user_password(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user(uuid) TO authenticated; 