-- Drop existing functions and triggers first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS create_user_with_username(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS auth.handle_new_user() CASCADE;
  DROP TRIGGER IF EXISTS new_auth_user_trigger ON auth.users;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create function to handle new user setup
CREATE OR REPLACE FUNCTION auth.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Extract username from email (remove @merchant.local)
  NEW.username := split_part(NEW.email, '@', 1);
  
  -- Set raw_app_meta_data
  NEW.raw_app_meta_data := jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', NEW.username,
    'role', CASE 
      WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
      ELSE COALESCE(TG_ARGV[0]::text, 'user')
    END
  );
  
  -- Set raw_user_meta_data
  NEW.raw_user_meta_data := jsonb_build_object(
    'username', NEW.username,
    'role', CASE 
      WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
      ELSE COALESCE(TG_ARGV[0]::text, 'user')
    END
  );
  
  -- Set email_confirmed_at for immediate access
  NEW.email_confirmed_at := now();
  
  -- Set role to authenticated
  NEW.role := 'authenticated';
  
  -- Create user profile immediately
  INSERT INTO user_profiles (id, role)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
      ELSE COALESCE(TG_ARGV[0]::text, 'user')
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
DROP TRIGGER IF EXISTS new_auth_user_trigger ON auth.users;
CREATE TRIGGER new_auth_user_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.handle_new_user();

-- Create function to create user with role
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
      'username', p_username,
      'role', p_role
    ),
    jsonb_build_object(
      'username', p_username,
      'role', p_role
    ),
    'authenticated'
  )
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, text) TO authenticated;