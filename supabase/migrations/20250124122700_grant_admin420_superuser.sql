-- Grant superuser privileges to admin420
UPDATE auth.users
SET 
  is_super_admin = true,
  raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
    'is_super_admin', true,
    'is_owner', true
  )
WHERE email = 'admin420@merchant.local';

-- Ensure admin420 has all necessary permissions
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get admin420's user ID
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

  IF v_admin_id IS NOT NULL THEN
    -- Update user profile
    INSERT INTO user_profiles (id, role, created_at, updated_at)
    VALUES (v_admin_id, 'admin', now(), now())
    ON CONFLICT (id) DO UPDATE 
    SET 
      role = 'admin',
      updated_at = now();

    -- Update user metadata
    UPDATE auth.users
    SET 
      raw_app_meta_data = jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email'],
        'role', 'admin',
        'is_super_admin', true,
        'is_owner', true
      ),
      raw_user_meta_data = jsonb_build_object(
        'email_verified', true,
        'role', 'admin',
        'is_super_admin', true
      ),
      role = 'service_role',  -- Give service_role access
      aud = 'authenticated',
      updated_at = now()
    WHERE id = v_admin_id;
  END IF;
END $$;

-- Create a function to check if user is super admin
CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT EXISTS (
      SELECT 1 
      FROM auth.users 
      WHERE id = auth.uid() 
      AND is_super_admin = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the new function
GRANT EXECUTE ON FUNCTION auth.is_super_admin() TO authenticated;

-- Update the is_admin function to include super admin check
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT EXISTS (
      SELECT 1 
      FROM auth.users u
      JOIN user_profiles p ON p.id = u.id
      WHERE u.id = auth.uid() 
      AND (p.role = 'admin' OR u.is_super_admin = true)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 