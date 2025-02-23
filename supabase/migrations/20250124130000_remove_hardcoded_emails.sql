-- Drop functions that use hardcoded emails
DROP FUNCTION IF EXISTS auth.create_user_with_role(text, text, text);

-- Create a new user creation function that doesn't use hardcoded emails
CREATE OR REPLACE FUNCTION auth.create_new_user(
  email text,
  password text,
  role text DEFAULT 'user'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Only admins can create other admin users
  IF role = 'admin' AND NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create other admin users';
  END IF;

  -- Only admins and merchants can create merchant users
  IF role = 'merchant' AND NOT auth.is_merchant() THEN
    RAISE EXCEPTION 'Only admins and merchants can create merchant users';
  END IF;

  -- Create the user in auth.users
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_app_meta_data)
  VALUES (
    email,
    crypt(password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email')
  )
  RETURNING id INTO v_user_id;

  -- Create profile with role
  INSERT INTO profiles (id, role)
  VALUES (v_user_id, role);

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing policies to use role-based checks
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (
    auth.uid() = id OR auth.is_admin()
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (
    auth.uid() = id OR auth.is_admin()
  );

-- Remove any remaining hardcoded email references
UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data - 'is_merchant_local';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auth.create_new_user TO authenticated;

COMMENT ON FUNCTION auth.create_new_user IS 'Creates a new user with the specified role. Only admins can create admin users, and only admins/merchants can create merchant users.'; 