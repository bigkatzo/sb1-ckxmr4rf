-- Drop existing function
DROP FUNCTION IF EXISTS create_user_with_username(text, text, user_role);

-- Create function with proper instance ID handling
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

  -- Create user directly in auth.users first
  INSERT INTO auth.users (
    instance_id,  -- Use the project's instance ID
    email,
    encrypted_password,
    email_confirmed_at,
    aud,
    role,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    last_sign_in_at,
    confirmation_token
  )
  SELECT
    -- Get instance_id from an existing user (admin420)
    (SELECT instance_id FROM auth.users WHERE email = 'admin420@merchant.local'),
    v_email,
    -- Use Supabase's password hashing format
    crypt(p_password, gen_salt('bf', 10)),
    now(),
    'authenticated',
    'authenticated',
    jsonb_build_object(
      'role', p_role::text,
      'provider', 'email',
      'providers', ARRAY['email']
    ),
    jsonb_build_object(
      'role', p_role::text
    ),
    now(),
    now(),
    now(),
    encode(gen_random_bytes(32), 'hex')
  RETURNING id INTO v_user_id;

  -- Create auth identity
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email
    ),
    'email',
    now(),
    now(),
    now()
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

  -- Verify the user was created with proper password
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = v_user_id 
    AND encrypted_password = crypt(p_password, encrypted_password)
  ) THEN
    RAISE EXCEPTION 'Failed to verify password hash';
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, user_role) TO authenticated; 