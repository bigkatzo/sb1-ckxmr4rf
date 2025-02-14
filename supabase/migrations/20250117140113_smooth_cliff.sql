-- Drop existing function if it exists
DROP FUNCTION IF EXISTS ensure_user_exists;

-- Create function to reset user password
CREATE OR REPLACE FUNCTION reset_user_password(
  p_email text,
  p_password text
)
RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET encrypted_password = crypt(p_password, gen_salt('bf'))
  WHERE email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset user420's password
DO $$ 
BEGIN
  -- First ensure user exists
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'user420@merchant.local'
  ) THEN
    -- Create user420 if doesn't exist
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
    );
  ELSE
    -- Reset password for existing user
    PERFORM reset_user_password('user420@merchant.local', 'St0pClickin!123');
  END IF;

  -- Ensure user has merchant role
  INSERT INTO user_profiles (id, role)
  SELECT id, 'merchant'
  FROM auth.users
  WHERE email = 'user420@merchant.local'
  ON CONFLICT (id) DO UPDATE
  SET role = 'merchant';
END $$;