-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create improved function to handle username-based sign up
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Extract username from email (remove @merchant.local)
  NEW.username := split_part(NEW.email, '@', 1);
  
  -- Set raw_app_meta_data
  NEW.raw_app_meta_data := jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', NEW.username
  );
  
  -- Set raw_user_meta_data
  NEW.raw_user_meta_data := jsonb_build_object(
    'username', NEW.username
  );
  
  -- Set email_confirmed_at for immediate access
  NEW.email_confirmed_at := now();
  
  -- Set role to authenticated
  NEW.role = 'authenticated';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Update create_user_with_username function to handle username validation
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admin can create users';
  END IF;

  -- Validate username
  IF NOT (p_username ~ '^[a-zA-Z0-9_-]{3,20}$') THEN
    RAISE EXCEPTION 'Invalid username. Use 3-20 characters, letters, numbers, underscore or hyphen only.';
  END IF;

  -- Check if username exists
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE username = p_username 
    OR email = p_username || '@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  -- Create user in auth.users
  INSERT INTO auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role
  ) VALUES (
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
  VALUES (v_user_id, p_role);

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing users to ensure proper setup
UPDATE auth.users
SET 
  username = COALESCE(username, split_part(email, '@', 1)),
  raw_app_meta_data = CASE 
    WHEN raw_app_meta_data IS NULL OR raw_app_meta_data = '{}'::jsonb THEN
      jsonb_build_object(
        'provider', 'username',
        'providers', array['username'],
        'username', COALESCE(username, split_part(email, '@', 1))
      )
    ELSE raw_app_meta_data
  END,
  raw_user_meta_data = CASE
    WHEN raw_user_meta_data IS NULL OR raw_user_meta_data = '{}'::jsonb THEN
      jsonb_build_object(
        'username', COALESCE(username, split_part(email, '@', 1))
      )
    ELSE raw_user_meta_data
  END,
  role = 'authenticated'
WHERE email LIKE '%@merchant.local';