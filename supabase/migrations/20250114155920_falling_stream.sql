-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('admin', 'merchant', 'user');

-- Create user_profiles table
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create collection_access table for managing collection assignments
CREATE TABLE collection_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(collection_id, user_id)
);

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is merchant
CREATE OR REPLACE FUNCTION auth.is_merchant()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'merchant')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check collection access
CREATE OR REPLACE FUNCTION auth.has_collection_access(collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (
    -- Admin has access to everything
    auth.is_admin()
    OR
    -- Merchant has access to own collections
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND user_id = auth.uid()
    )
    OR
    -- User has explicit access through collection_access
    EXISTS (
      SELECT 1 FROM collection_access
      WHERE collection_id = collection_id
      AND user_id = auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to manage user roles (admin only)
CREATE OR REPLACE FUNCTION manage_user_role(
  p_user_id uuid,
  p_role user_role
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admins can manage user roles';
  END IF;

  -- Update or insert user profile
  INSERT INTO user_profiles (id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (id) 
  DO UPDATE SET 
    role = p_role,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to grant collection access
CREATE OR REPLACE FUNCTION grant_collection_access(
  p_collection_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin or merchant owner of collection
  IF NOT (
    auth.is_admin() OR 
    EXISTS (
      SELECT 1 FROM collections 
      WHERE id = p_collection_id 
      AND user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to grant collection access';
  END IF;

  -- Grant access
  INSERT INTO collection_access (collection_id, user_id, granted_by)
  VALUES (p_collection_id, p_user_id, auth.uid())
  ON CONFLICT (collection_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to revoke collection access
CREATE OR REPLACE FUNCTION revoke_collection_access(
  p_collection_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin or merchant owner of collection
  IF NOT (
    auth.is_admin() OR 
    EXISTS (
      SELECT 1 FROM collections 
      WHERE id = p_collection_id 
      AND user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to revoke collection access';
  END IF;

  -- Revoke access
  DELETE FROM collection_access 
  WHERE collection_id = p_collection_id 
  AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on new tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR auth.is_admin());

CREATE POLICY "Only admins can modify profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Create policies for collection_access
CREATE POLICY "Users can view own access"
  ON collection_access FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR auth.is_admin() 
    OR EXISTS (
      SELECT 1 FROM collections 
      WHERE id = collection_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins and merchants can manage access"
  ON collection_access FOR ALL
  TO authenticated
  USING (
    auth.is_admin() OR
    EXISTS (
      SELECT 1 FROM collections 
      WHERE id = collection_id 
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.is_admin() OR
    EXISTS (
      SELECT 1 FROM collections 
      WHERE id = collection_id 
      AND user_id = auth.uid()
    )
  );

-- Set up admin420 as admin
INSERT INTO user_profiles (id, role)
SELECT id, 'admin'::user_role
FROM auth.users 
WHERE email = 'admin420@merchant.local'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin'::user_role;