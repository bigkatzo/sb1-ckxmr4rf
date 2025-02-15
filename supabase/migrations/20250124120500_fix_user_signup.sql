-- Drop existing function
DROP FUNCTION IF EXISTS create_user_with_username(text, text, user_role);

-- Create function using Supabase's auth.sign_up
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

  -- Use Supabase's auth.sign_up to properly handle user creation and password hashing
  v_user_id := (
    SELECT id FROM auth.sign_up(
      v_email,
      p_password,
      jsonb_build_object(
        'role', p_role::text
      )
    )
  );

  -- Confirm email immediately
  UPDATE auth.users 
  SET email_confirmed_at = now(),
      updated_at = now(),
      last_sign_in_at = now(),
      raw_app_meta_data = raw_app_meta_data || 
        jsonb_build_object(
          'provider', 'email',
          'providers', ARRAY['email']
        )
  WHERE id = v_user_id;

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

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, user_role) TO authenticated; 