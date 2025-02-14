-- Create function to ensure user exists with correct password
CREATE OR REPLACE FUNCTION ensure_user_exists(
  p_email text,
  p_password text,
  p_username text,
  p_role text
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- First try to get existing user
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email;

  IF v_user_id IS NULL THEN
    -- Create new user if doesn't exist
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
      p_email,
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
  ELSE
    -- Update existing user
    UPDATE auth.users
    SET 
      encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = now(),
      raw_app_meta_data = jsonb_build_object(
        'provider', 'username',
        'providers', array['username'],
        'username', p_username
      ),
      raw_user_meta_data = jsonb_build_object(
        'username', p_username
      )
    WHERE id = v_user_id;
  END IF;

  -- Ensure user profile exists with correct role
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, p_role)
  ON CONFLICT (id) DO UPDATE
  SET role = p_role;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user420 with merchant role
SELECT ensure_user_exists(
  'user420@merchant.local',
  'St0pClickin!123',
  'user420',
  'merchant'
);