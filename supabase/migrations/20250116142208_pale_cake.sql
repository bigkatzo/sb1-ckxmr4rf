-- Drop existing policies first to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "public_view_collections" ON collections;
  DROP POLICY IF EXISTS "public_view_products" ON products;
  DROP POLICY IF EXISTS "public_view_categories" ON categories;
  DROP POLICY IF EXISTS "authenticated_manage_collections" ON collections;
  DROP POLICY IF EXISTS "authenticated_manage_products" ON products;
  DROP POLICY IF EXISTS "authenticated_manage_categories" ON categories;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Drop existing admin-related functions
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
DROP FUNCTION IF EXISTS auth.get_admin_id() CASCADE;

-- Create simplified admin check function that uses email directly
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Use direct email check without role assumptions
  RETURN current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset admin420's role to authenticated
UPDATE auth.users
SET 
  role = 'authenticated',
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', 'admin420'
  ),
  raw_user_meta_data = jsonb_build_object(
    'username', 'admin420'
  )
WHERE email = 'admin420@merchant.local';

-- Create public policies for anonymous access
CREATE POLICY "anon_view_collections"
  ON collections FOR SELECT
  TO public
  USING (visible = true);

CREATE POLICY "anon_view_products"
  ON products FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.visible = true
    )
  );

CREATE POLICY "anon_view_categories"
  ON categories FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.visible = true
    )
  );

-- Create authenticated access policies
CREATE POLICY "auth_manage_collections"
  ON collections FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR auth.is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR auth.is_admin()
  );

CREATE POLICY "auth_manage_products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (c.user_id = auth.uid() OR auth.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (c.user_id = auth.uid() OR auth.is_admin())
    )
  );

CREATE POLICY "auth_manage_categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (c.user_id = auth.uid() OR auth.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (c.user_id = auth.uid() OR auth.is_admin())
    )
  );

-- Grant basic permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant read-only permissions to anon
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant full permissions to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create function to check database connection
CREATE OR REPLACE FUNCTION check_database_connection()
RETURNS boolean AS $$
BEGIN
  PERFORM now();
  RETURN true;
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on connection check
GRANT EXECUTE ON FUNCTION check_database_connection() TO anon;
GRANT EXECUTE ON FUNCTION check_database_connection() TO authenticated;