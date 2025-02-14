-- Create helper function first
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'admin420@merchant.local'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'merchant', 'user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_collection_access table
CREATE TABLE IF NOT EXISTS user_collection_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
  access_type text NOT NULL CHECK (access_type IN ('view', 'manage')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, collection_id)
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collection_access ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
CREATE POLICY "view_own_profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "admin_manage_profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create RLS policies for user_collection_access
CREATE POLICY "view_own_access"
  ON user_collection_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "admin_manage_access"
  ON user_collection_access FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Function to manage user roles (admin only)
CREATE OR REPLACE FUNCTION manage_user_role(
  p_user_id uuid,
  p_role text
)
RETURNS void AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admin can manage user roles';
  END IF;

  INSERT INTO user_profiles (id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (id) 
  DO UPDATE SET 
    role = p_role,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to grant collection access
CREATE OR REPLACE FUNCTION grant_collection_access(
  p_collection_id uuid,
  p_user_id uuid,
  p_access_type text
)
RETURNS void AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admin can grant collection access';
  END IF;

  INSERT INTO user_collection_access (
    user_id,
    collection_id,
    access_type,
    granted_by
  )
  VALUES (
    p_user_id,
    p_collection_id,
    p_access_type,
    auth.uid()
  )
  ON CONFLICT (user_id, collection_id) 
  DO UPDATE SET 
    access_type = p_access_type,
    granted_by = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke collection access
CREATE OR REPLACE FUNCTION revoke_collection_access(
  p_collection_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admin can revoke collection access';
  END IF;

  DELETE FROM user_collection_access
  WHERE collection_id = p_collection_id
  AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update collections policies to check user access
DROP POLICY IF EXISTS "collections_policy" ON collections;
CREATE POLICY "collections_policy"
  ON collections
  USING (
    visible = true 
    OR user_id = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM user_collection_access
      WHERE collection_id = id
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR is_admin()
  );

-- Update products policies to check user access
DROP POLICY IF EXISTS "products_policy" ON products;
CREATE POLICY "products_policy"
  ON products
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.visible = true 
        OR c.user_id = auth.uid()
        OR is_admin()
        OR EXISTS (
          SELECT 1 FROM user_collection_access
          WHERE collection_id = c.id
          AND user_id = auth.uid()
          AND access_type = 'manage'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.user_id = auth.uid()
        OR is_admin()
        OR EXISTS (
          SELECT 1 FROM user_collection_access
          WHERE collection_id = c.id
          AND user_id = auth.uid()
          AND access_type = 'manage'
        )
      )
    )
  );

-- Update categories policies to check user access
DROP POLICY IF EXISTS "categories_policy" ON categories;
CREATE POLICY "categories_policy"
  ON categories
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.visible = true 
        OR c.user_id = auth.uid()
        OR is_admin()
        OR EXISTS (
          SELECT 1 FROM user_collection_access
          WHERE collection_id = c.id
          AND user_id = auth.uid()
          AND access_type = 'manage'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.user_id = auth.uid()
        OR is_admin()
        OR EXISTS (
          SELECT 1 FROM user_collection_access
          WHERE collection_id = c.id
          AND user_id = auth.uid()
          AND access_type = 'manage'
        )
      )
    )
  );

-- Set up admin420 as admin
INSERT INTO user_profiles (id, role)
SELECT id, 'admin'
FROM auth.users 
WHERE email = 'admin420@merchant.local'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin';