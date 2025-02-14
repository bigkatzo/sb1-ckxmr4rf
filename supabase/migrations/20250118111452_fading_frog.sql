-- First drop ALL policies that could depend on our functions
DO $$ BEGIN
  -- Drop collection policies
  DROP POLICY IF EXISTS "merchant_collections_view" ON collections;
  DROP POLICY IF EXISTS "merchant_collections_manage" ON collections;
  DROP POLICY IF EXISTS "merchant_collections_modify" ON collections;
  DROP POLICY IF EXISTS "merchant_collections_remove" ON collections;
  DROP POLICY IF EXISTS "collections_policy" ON collections;
  
  -- Drop product policies
  DROP POLICY IF EXISTS "merchant_products_view" ON products;
  DROP POLICY IF EXISTS "merchant_products_manage" ON products;
  DROP POLICY IF EXISTS "merchant_products_modify" ON products;
  DROP POLICY IF EXISTS "merchant_products_remove" ON products;
  DROP POLICY IF EXISTS "products_policy" ON products;
  
  -- Drop category policies
  DROP POLICY IF EXISTS "merchant_categories_view" ON categories;
  DROP POLICY IF EXISTS "merchant_categories_manage" ON categories;
  DROP POLICY IF EXISTS "merchant_categories_modify" ON categories;
  DROP POLICY IF EXISTS "merchant_categories_remove" ON categories;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Now drop all functions with CASCADE to ensure clean slate
DROP FUNCTION IF EXISTS auth.get_collection_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS auth.get_user_role() CASCADE;
DROP FUNCTION IF EXISTS list_users() CASCADE;
DROP FUNCTION IF EXISTS manage_collection_access(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS get_user_collection_access(uuid) CASCADE;

-- Create enum for access levels if not exists
DO $$ BEGIN
  CREATE TYPE access_level AS ENUM ('none', 'view', 'manage');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create function to check user role with caching
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  -- First check if user is admin420
  IF auth.is_admin() THEN
    RETURN 'admin';
  END IF;

  -- Get role from user_profiles
  SELECT role INTO v_role
  FROM user_profiles
  WHERE id = auth.uid();

  RETURN COALESCE(v_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check collection access level
CREATE OR REPLACE FUNCTION auth.get_collection_access(collection_id uuid)
RETURNS text AS $$
DECLARE
  v_role text;
  v_access text;
BEGIN
  -- Get user's role
  v_role := auth.get_user_role();
  
  -- Admin has full access
  IF v_role = 'admin' THEN
    RETURN 'manage';
  END IF;

  -- Check if user owns collection
  IF EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  ) THEN
    RETURN 'manage';
  END IF;

  -- Check explicit collection access
  SELECT access_type INTO v_access
  FROM collection_access
  WHERE collection_id = collection_id
  AND user_id = auth.uid();

  -- Return explicit access or none
  RETURN COALESCE(v_access, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to list users with details
CREATE OR REPLACE FUNCTION list_users()
RETURNS TABLE (
  id uuid,
  username text,
  email text,
  role text,
  created_at timestamptz,
  collections_count bigint,
  access_count bigint
) AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.raw_user_meta_data->>'username' as username,
    u.email,
    COALESCE(p.role, 'user') as role,
    u.created_at,
    COUNT(DISTINCT c.id) as collections_count,
    COUNT(DISTINCT ca.collection_id) as access_count
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  LEFT JOIN collections c ON c.user_id = u.id
  LEFT JOIN collection_access ca ON ca.user_id = u.id
  WHERE u.email != 'admin420@merchant.local'
  GROUP BY u.id, u.email, p.role
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to manage collection access
CREATE OR REPLACE FUNCTION manage_collection_access(
  p_user_id uuid,
  p_collection_id uuid,
  p_access_type text
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin or collection owner
  IF NOT (
    auth.is_admin() OR 
    EXISTS (
      SELECT 1 FROM collections 
      WHERE id = p_collection_id 
      AND user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to manage collection access';
  END IF;

  -- Remove access if none
  IF p_access_type = 'none' THEN
    DELETE FROM collection_access
    WHERE user_id = p_user_id
    AND collection_id = p_collection_id;
    RETURN;
  END IF;

  -- Insert or update access
  INSERT INTO collection_access (
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
    access_type = EXCLUDED.access_type,
    granted_by = EXCLUDED.granted_by;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's collection access
CREATE OR REPLACE FUNCTION get_user_collection_access(p_user_id uuid)
RETURNS TABLE (
  collection_id uuid,
  collection_name text,
  access_type text,
  granted_by_username text,
  granted_at timestamptz
) AS $$
BEGIN
  -- Verify caller is admin or user themselves
  IF NOT (auth.is_admin() OR auth.uid() = p_user_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    ca.collection_id,
    c.name as collection_name,
    ca.access_type,
    (SELECT raw_user_meta_data->>'username' FROM auth.users WHERE id = ca.granted_by) as granted_by_username,
    ca.created_at as granted_at
  FROM collection_access ca
  JOIN collections c ON c.id = ca.collection_id
  WHERE ca.user_id = p_user_id
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new RLS policies for collections
CREATE POLICY "collections_policy"
  ON collections
  USING (
    visible = true 
    OR auth.get_collection_access(id) != 'none'
  )
  WITH CHECK (
    auth.get_collection_access(id) = 'manage'
  );

-- Create new RLS policies for products
CREATE POLICY "products_policy"
  ON products
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.visible = true 
        OR auth.get_collection_access(c.id) != 'none'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND auth.get_collection_access(c.id) = 'manage'
    )
  );

-- Create new RLS policies for categories
CREATE POLICY "categories_policy"
  ON categories
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.visible = true 
        OR auth.get_collection_access(c.id) != 'none'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND auth.get_collection_access(c.id) = 'manage'
    )
  );

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_collection_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION manage_collection_access(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_collection_access(uuid) TO authenticated;