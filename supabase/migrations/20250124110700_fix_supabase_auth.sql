-- First, remove any existing test user
DELETE FROM auth.users WHERE email = 'supauser@merchant.local';

-- Create function to properly create users using Supabase's auth
CREATE OR REPLACE FUNCTION create_merchant_user(
  p_email text,
  p_password text,
  p_role text DEFAULT 'merchant'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Create the user through Supabase auth API
  v_user_id := auth.sign_up(
    p_email,
    p_password,
    jsonb_build_object(
      'role', p_role
    )
  );

  -- Confirm email immediately
  UPDATE auth.users SET 
    email_confirmed_at = now(),
    confirmed_at = now(),
    raw_app_meta_data = jsonb_build_object(
      'provider', 'email',
      'providers', array['email'],
      'role', p_role
    ),
    raw_user_meta_data = jsonb_build_object(
      'role', p_role
    ),
    role = 'authenticated',
    updated_at = now()
  WHERE id = v_user_id;

  -- Create user profile
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, p_role)
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create test user using the new function
SELECT create_merchant_user('supauser@merchant.local', 'password123');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO postgres, authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.sign_up(text,text,jsonb) TO postgres, authenticated, anon; 