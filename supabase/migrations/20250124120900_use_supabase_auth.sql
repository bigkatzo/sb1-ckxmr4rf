-- Drop existing function
DROP FUNCTION IF EXISTS create_user_with_username(text, text, user_role);

-- Create function using Supabase's auth functions
CREATE OR REPLACE FUNCTION create_user_with_username(
  p_username text,
  p_password text,
  p_role user_role DEFAULT 'user'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  -- Check admin authorization using RBAC
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can create users';
  END IF;

  -- Validate username
  PERFORM validate_username(p_username);
  
  -- Create email
  v_email := p_username || '@merchant.local';

  -- Use Supabase's auth.create_user function
  SELECT id INTO v_user_id
  FROM auth.create_user(
    jsonb_build_object(
      'email', v_email,
      'password', p_password,
      'email_confirm', true,
      'user_metadata', jsonb_build_object(
        'role', p_role::text
      ),
      'app_metadata', jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email'],
        'role', p_role::text
      )
    )
  );

  -- Create profile with proper role
  INSERT INTO user_profiles (
    id,
    role,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_role,
    now(),
    now()
  );

  -- Verify user was created
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Failed to create user';
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, user_role) TO authenticated;

-- Add helper function to check user creation
CREATE OR REPLACE FUNCTION check_user_creation(p_email text)
RETURNS TABLE (
  id uuid,
  email text,
  encrypted_password text,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  role text,
  has_identity boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.encrypted_password,
    u.raw_app_meta_data,
    u.raw_user_meta_data,
    p.role::text,
    EXISTS (SELECT 1 FROM auth.identities WHERE user_id = u.id) as has_identity
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 