-- Create function to ensure user profile exists
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile
DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
CREATE TRIGGER ensure_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_profile();

-- Create function to validate user creation
CREATE OR REPLACE FUNCTION validate_user_creation()
RETURNS trigger AS $$
BEGIN
  -- Ensure email follows our pattern
  IF NEW.email NOT LIKE '%@merchant.local' THEN
    RAISE EXCEPTION 'Invalid email domain. Must end with @merchant.local';
  END IF;

  -- Set confirmed email by default
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  
  -- Set default metadata
  NEW.raw_app_meta_data := jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', split_part(NEW.email, '@', 1)
  );
  
  NEW.raw_user_meta_data := jsonb_build_object(
    'username', split_part(NEW.email, '@', 1)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user validation
DROP TRIGGER IF EXISTS validate_user_creation_trigger ON auth.users;
CREATE TRIGGER validate_user_creation_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_creation();

-- Update create_user_with_username function to handle profiles
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

  -- Check if username exists
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = p_username || '@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  -- Create user in auth.users
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
    p_username || '@merchant.local',
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
      'username', p_username
    ),
    jsonb_build_object(
      'username', p_username
    ),
    'authenticated'
  )
  RETURNING id INTO v_user_id;

  -- Create user profile with role
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, p_role)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check database connection
CREATE OR REPLACE FUNCTION check_database_connection()
RETURNS boolean AS $$
BEGIN
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_database_connection() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- Ensure all existing users have profiles
INSERT INTO user_profiles (id, role)
SELECT id, 'user'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles p WHERE p.id = u.id
)
AND email != 'admin420@merchant.local'
ON CONFLICT (id) DO NOTHING;