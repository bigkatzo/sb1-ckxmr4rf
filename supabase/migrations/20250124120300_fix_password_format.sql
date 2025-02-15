-- Drop existing function
DROP FUNCTION IF EXISTS create_user_with_username(text, text, text);

-- Create function with Supabase's exact password format
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
  v_salt text;
  v_encrypted_password text;
BEGIN
  -- Only allow admin420 to create users
  IF NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') != 'admin420@merchant.local' THEN
    RAISE EXCEPTION 'Only admin420 can create users';
  END IF;

  -- Set current timestamp
  v_now := now();
  
  -- Create email by appending @merchant.local
  v_email := p_username || '@merchant.local';

  -- Generate salt and hash password using Supabase's format
  v_salt := gen_salt('bf', 10);  -- Cost factor of 10 matches Supabase default
  v_encrypted_password := '$2a$10$' || v_salt || crypt(p_password, '$2a$10$' || v_salt);

  -- Insert directly into auth.users with all required fields
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',  -- instance_id
    gen_random_uuid(),                        -- id
    'authenticated',                          -- aud
    'authenticated',                          -- role
    v_email,                                 -- email
    v_encrypted_password,                    -- encrypted_password in Supabase format
    v_now,                                   -- email_confirmed_at
    v_now,                                   -- last_sign_in_at
    jsonb_build_object(                      -- raw_app_meta_data
      'provider', 'email',
      'providers', ARRAY['email'],
      'role', p_role
    ),
    jsonb_build_object(                      -- raw_user_meta_data
      'role', p_role
    ),
    false,                                   -- is_super_admin
    v_now,                                   -- created_at
    v_now,                                   -- updated_at
    '',                                      -- confirmation_token
    '',                                      -- email_change
    '',                                      -- email_change_token_new
    ''                                       -- recovery_token
  )
  RETURNING id INTO v_user_id;

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

  -- Insert into auth.identities
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
    v_user_id,                               -- id
    v_user_id,                               -- user_id
    jsonb_build_object(                      -- identity_data
      'sub', v_user_id::text,
      'email', v_email
    ),
    'email',                                 -- provider
    v_now,                                   -- last_sign_in_at
    v_now,                                   -- created_at
    v_now                                    -- updated_at
  );

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, text) TO authenticated; 