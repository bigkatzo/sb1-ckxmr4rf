-- Create function to delete user
CREATE OR REPLACE FUNCTION delete_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can delete users';
  END IF;

  -- Don't allow deleting admin420
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND email = 'admin420@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Cannot delete admin user';
  END IF;

  -- Delete user from auth.users (will cascade to user_profiles)
  DELETE FROM auth.users
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update user
CREATE OR REPLACE FUNCTION update_user(
  p_user_id uuid,
  p_username text,
  p_role text
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can update users';
  END IF;

  -- Don't allow modifying admin420
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND email = 'admin420@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Cannot modify admin user';
  END IF;

  -- Validate username
  IF NOT (p_username ~ '^[a-zA-Z0-9_-]{3,20}$') THEN
    RAISE EXCEPTION 'Invalid username. Use 3-20 characters, letters, numbers, underscore or hyphen only.';
  END IF;

  -- Check if new username is taken by another user
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = p_username || '@merchant.local'
    AND id != p_user_id
  ) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  -- Update user
  UPDATE auth.users
  SET 
    email = p_username || '@merchant.local',
    raw_app_meta_data = jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
      'username', p_username
    ),
    raw_user_meta_data = jsonb_build_object(
      'username', p_username
    )
  WHERE id = p_user_id;

  -- Update role
  INSERT INTO user_profiles (id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user(uuid, text, text) TO authenticated;