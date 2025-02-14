-- Drop existing function if exists
DROP FUNCTION IF EXISTS reset_user_password;

-- Create improved function to reset user password
CREATE OR REPLACE FUNCTION reset_user_password(
  p_email text,
  p_password text
)
RETURNS void AS $$
BEGIN
  -- Update password and ensure email is confirmed
  UPDATE auth.users
  SET 
    encrypted_password = crypt(p_password, gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE email = p_email;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset user420's password and ensure proper setup
DO $$ 
DECLARE
  v_user_id uuid;
BEGIN
  -- Get or create user420
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'user420@merchant.local';

  IF v_user_id IS NULL THEN
    -- Create user if doesn't exist
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
      'user420@merchant.local',
      crypt('St0pClickin!123', gen_salt('bf')),
      now(),
      jsonb_build_object(
        'provider', 'username',
        'providers', array['username'],
        'username', 'user420'
      ),
      jsonb_build_object(
        'username', 'user420'
      ),
      'authenticated'
    )
    RETURNING id INTO v_user_id;
  ELSE
    -- Reset password for existing user
    UPDATE auth.users
    SET 
      encrypted_password = crypt('St0pClickin!123', gen_salt('bf')),
      email_confirmed_at = now(),
      raw_app_meta_data = jsonb_build_object(
        'provider', 'username',
        'providers', array['username'],
        'username', 'user420'
      ),
      raw_user_meta_data = jsonb_build_object(
        'username', 'user420'
      ),
      role = 'authenticated',
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Ensure user has merchant role
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, 'merchant')
  ON CONFLICT (id) DO UPDATE
  SET role = 'merchant';

  -- Grant collection access if needed
  INSERT INTO collection_access (user_id, collection_id, access_type)
  SELECT v_user_id, id, 'manage'
  FROM collections
  WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'admin420@merchant.local'
  )
  ON CONFLICT (user_id, collection_id) DO NOTHING;
END $$;

-- Verify user420 setup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN user_profiles p ON p.id = u.id
    WHERE u.email = 'user420@merchant.local'
    AND p.role = 'merchant'
    AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'User420 setup verification failed';
  END IF;
END $$;