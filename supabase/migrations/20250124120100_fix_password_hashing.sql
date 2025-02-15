-- Drop existing function
DROP FUNCTION IF EXISTS create_user_with_username(text, text, text);

-- Create function using Supabase Auth's password handling
CREATE OR REPLACE FUNCTION create_user_with_username(
  p_username text,
  p_password text,
  p_role text DEFAULT 'user'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_now timestamptz;
BEGIN
  -- Only allow admin420 to create users
  IF NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') != 'admin420@merchant.local' THEN
    RAISE EXCEPTION 'Only admin420 can create users';
  END IF;

  -- Set current timestamp
  v_now := now();
  
  -- Create email by appending @merchant.local
  v_email := p_username || '@merchant.local';

  -- Use Supabase's auth.create_user function
  v_user_id := auth.create_user(
    jsonb_build_object(
      'email', v_email,
      'password', p_password,
      'email_confirm', true,
      'instance_id', '00000000-0000-0000-0000-000000000000',
      'raw_app_meta_data', jsonb_build_object(
        'role', p_role,
        'provider', 'email'
      ),
      'raw_user_meta_data', jsonb_build_object(
        'role', p_role,
        'provider', 'email'
      ),
      'role', 'authenticated',
      'created_at', v_now,
      'updated_at', v_now,
      'last_sign_in_at', v_now,
      'confirmation_sent_at', v_now
    )
  );

  -- Create matching profile in user_profiles
  INSERT INTO user_profiles (
    id,
    role,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_role,
    v_now,
    v_now
  );

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, text) TO authenticated; 