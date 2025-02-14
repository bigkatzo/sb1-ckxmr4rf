-- Create function to get user's role
CREATE OR REPLACE FUNCTION auth.get_role()
RETURNS user_role AS $$
BEGIN
  -- Admin420 is always admin
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email = 'admin420@merchant.local'
  ) THEN
    RETURN 'admin'::user_role;
  END IF;

  -- Otherwise check user_permissions
  RETURN COALESCE(
    (SELECT role FROM user_permissions WHERE user_id = auth.uid()),
    'intern'::user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN auth.get_role() = 'admin'::user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is merchant
CREATE OR REPLACE FUNCTION auth.is_merchant()
RETURNS boolean AS $$
BEGIN
  RETURN auth.get_role() IN ('admin'::user_role, 'merchant'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;