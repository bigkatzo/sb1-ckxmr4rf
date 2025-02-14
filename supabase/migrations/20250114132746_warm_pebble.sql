-- Drop existing policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Collections access" ON collections;
  DROP POLICY IF EXISTS "Products access" ON products;
  DROP POLICY IF EXISTS "Categories access" ON categories;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create admin check function that doesn't require users table access
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Use JWT claim instead of querying users table
  RETURN current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update collections policy
CREATE POLICY "collections_policy"
  ON collections
  USING (
    visible = true 
    OR auth.uid() = user_id
    OR auth.uid() = owner
    OR auth.uid() = owner_id
    OR auth.is_admin()
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = owner
    OR auth.uid() = owner_id
    OR auth.is_admin()
  );

-- Update products policy
CREATE POLICY "products_policy"
  ON products
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.visible = true 
        OR c.user_id = auth.uid()
        OR c.owner = auth.uid()
        OR c.owner_id = auth.uid()
        OR products.owner = auth.uid()
        OR products.owner_id = auth.uid()
        OR auth.is_admin()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.user_id = auth.uid()
        OR c.owner = auth.uid()
        OR c.owner_id = auth.uid()
        OR auth.uid() = products.owner
        OR auth.uid() = products.owner_id
        OR auth.is_admin()
      )
    )
  );

-- Update categories policy
CREATE POLICY "categories_policy"
  ON categories
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.visible = true 
        OR c.user_id = auth.uid()
        OR c.owner = auth.uid()
        OR c.owner_id = auth.uid()
        OR auth.is_admin()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.user_id = auth.uid()
        OR c.owner = auth.uid()
        OR c.owner_id = auth.uid()
        OR auth.is_admin()
      )
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;