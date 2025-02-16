-- Create an enum for user roles if it doesn't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'merchant', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Drop existing functions
DROP FUNCTION IF EXISTS create_user_with_username(text, text, user_role);
DROP FUNCTION IF EXISTS auth.create_user(jsonb);

-- Create a wrapper around auth.create_user to ensure proper field values
CREATE OR REPLACE FUNCTION auth.create_user(
  IN input jsonb,
  OUT user_id uuid,
  OUT created_at timestamptz,
  OUT updated_at timestamptz,
  OUT confirmation_sent_at timestamptz,
  OUT email_confirmed_at timestamptz,
  OUT last_sign_in_at timestamptz,
  OUT raw_app_meta_data jsonb,
  OUT raw_user_meta_data jsonb,
  OUT aud text,
  OUT role text,
  OUT email text,
  OUT phone text,
  OUT providers text[],
  OUT identities jsonb,
  OUT instance_id uuid
)
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  _password text;
  _email text;
  _new_user auth.users;
BEGIN
  -- Extract email and password
  _email := input->>'email';
  _password := input->>'password';

  -- Basic validation
  IF _email IS NULL OR _password IS NULL THEN
    RAISE EXCEPTION 'Email and password are required';
  END IF;

  -- Create the user with all required fields
  INSERT INTO auth.users (
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change_token_new,
    email_change,
    recovery_token,
    email_change_token_current,
    phone_change,
    phone_change_token,
    confirmed_at,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    is_sso_user,
    deleted_at,
    is_anonymous,
    providers
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    _email,
    crypt(_password, gen_salt('bf', 6)),
    CASE WHEN (input->>'email_confirm')::boolean IS TRUE THEN now() ELSE null END,
    now(),
    COALESCE(
      input->'app_metadata',
      jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email']
      )
    ),
    COALESCE(
      input->'user_metadata',
      jsonb_build_object(
        'email_verified', true
      )
    ),
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    now(),
    0,
    null,
    '',
    false,
    null,
    false,
    ARRAY['email']
  )
  RETURNING * INTO _new_user;

  -- Create identity
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    _new_user.id,
    _new_user.id,
    jsonb_build_object(
      'sub', _new_user.id::text,
      'email', _email,
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- Return user data
  user_id := _new_user.id;
  created_at := _new_user.created_at;
  updated_at := _new_user.updated_at;
  confirmation_sent_at := _new_user.confirmation_sent_at;
  email_confirmed_at := _new_user.email_confirmed_at;
  last_sign_in_at := _new_user.last_sign_in_at;
  raw_app_meta_data := _new_user.raw_app_meta_data;
  raw_user_meta_data := _new_user.raw_user_meta_data;
  aud := _new_user.aud;
  role := _new_user.role;
  email := _new_user.email;
  phone := _new_user.phone;
  providers := _new_user.providers;
  identities := (
    SELECT jsonb_agg(identity_data)
    FROM auth.identities
    WHERE user_id = _new_user.id
  );
  instance_id := _new_user.instance_id;
END;
$$ LANGUAGE plpgsql;

-- Create the user creation function that uses the fixed auth.create_user
CREATE OR REPLACE FUNCTION create_user_with_username(
  p_username text,
  p_password text,
  p_role user_role DEFAULT 'user'
)
RETURNS uuid
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_now timestamptz;
BEGIN
  -- Check admin authorization
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can create users';
  END IF;

  -- Create email
  v_email := p_username || '@merchant.local';

  -- Create user using the fixed auth.create_user function
  SELECT (auth.create_user(
    jsonb_build_object(
      'email', v_email,
      'password', p_password,
      'email_confirm', true,
      'app_metadata', jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email'],
        'role', p_role::text
      ),
      'user_metadata', jsonb_build_object(
        'email_verified', true,
        'role', p_role::text
      )
    )
  )).user_id INTO v_user_id;

  -- Create profile
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
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.create_user(jsonb) TO authenticated; 