-- First drop existing functions
DROP FUNCTION IF EXISTS manage_user_role(uuid, text);
DROP FUNCTION IF EXISTS manage_user_role(uuid, user_role);

-- Create temporary table with text type for role
CREATE TEMP TABLE temp_user_profiles (
  id uuid,
  role text,
  created_at timestamptz,
  updated_at timestamptz
);

-- Copy data to temp table
INSERT INTO temp_user_profiles 
SELECT id, role::text, created_at, updated_at 
FROM user_profiles;

-- Now we can safely drop the table and type
DROP TABLE user_profiles CASCADE;
DROP TYPE IF EXISTS user_role;

-- Recreate type
CREATE TYPE user_role AS ENUM ('admin', 'merchant', 'user');

-- Recreate table with enum type
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'user'::user_role,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Restore data with proper casting
INSERT INTO user_profiles (id, role, created_at, updated_at)
SELECT 
  id,
  CASE 
    WHEN role = 'admin' THEN 'admin'::user_role
    WHEN role = 'merchant' THEN 'merchant'::user_role
    ELSE 'user'::user_role
  END,
  created_at,
  updated_at
FROM temp_user_profiles;

-- Drop temporary table
DROP TABLE temp_user_profiles;

-- Recreate manage_user_role function
CREATE OR REPLACE FUNCTION manage_user_role(
  p_user_id uuid,
  p_role user_role
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

-- Ensure admin420 has a profile
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local'
  LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO user_profiles (id, role)
    VALUES (v_admin_id, 'admin'::user_role)
    ON CONFLICT (id) DO UPDATE 
    SET role = 'admin'::user_role;
  END IF;
END $$;

-- Update RLS policies
DROP POLICY IF EXISTS "view_own_profile" ON user_profiles;
CREATE POLICY "view_own_profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email = 'admin420@merchant.local'
    )
  );

-- Create function to check if user is merchant
CREATE OR REPLACE FUNCTION is_merchant()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'merchant')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has collection access
CREATE OR REPLACE FUNCTION has_collection_access(p_collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = p_collection_id
    AND (
      -- User owns collection
      c.user_id = auth.uid()
      OR
      -- User is admin
      is_admin()
      OR
      -- User has explicit access
      EXISTS (
        SELECT 1 FROM user_collection_access
        WHERE collection_id = p_collection_id
        AND user_id = auth.uid()
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update collections policy
DROP POLICY IF EXISTS "collections_policy" ON collections;
CREATE POLICY "collections_policy"
  ON collections
  USING (
    visible = true 
    OR user_id = auth.uid()
    OR is_admin()
    OR has_collection_access(id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR is_admin()
  );