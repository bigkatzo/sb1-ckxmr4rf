-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "collections_policy" ON collections;
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create function to check if user is merchant
CREATE OR REPLACE FUNCTION auth.is_merchant()
RETURNS boolean AS $$
BEGIN
  -- Check if user has merchant role or is admin
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (role = 'merchant' OR role = 'admin')
  ) OR auth.is_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to ensure user profile exists
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS trigger AS $$
BEGIN
  -- Create merchant profile for all new users
  INSERT INTO user_profiles (id, role)
  VALUES (NEW.id, 'merchant')
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
CREATE TRIGGER ensure_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_profile();

-- Create RLS policies for collections
CREATE POLICY "collections_policy"
  ON collections
  USING (
    visible = true 
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM collection_access
      WHERE collection_id = id
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.is_merchant()
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM collection_access
        WHERE collection_id = id
        AND user_id = auth.uid()
        AND access_type = 'manage'
      )
    )
  );

-- Create RLS policies for products
CREATE POLICY "products_policy"
  ON products
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.visible = true 
        OR c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access ca
          WHERE ca.collection_id = c.id
          AND ca.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    auth.is_merchant()
    AND EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access ca
          WHERE ca.collection_id = c.id
          AND ca.user_id = auth.uid()
          AND ca.access_type = 'manage'
        )
      )
    )
  );

-- Create RLS policies for categories
CREATE POLICY "categories_policy"
  ON categories
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.visible = true 
        OR c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access ca
          WHERE ca.collection_id = c.id
          AND ca.user_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    auth.is_merchant()
    AND EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access ca
          WHERE ca.collection_id = c.id
          AND ca.user_id = auth.uid()
          AND ca.access_type = 'manage'
        )
      )
    )
  );

-- Create function to check database connection
CREATE OR REPLACE FUNCTION check_database_connection()
RETURNS boolean AS $$
BEGIN
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auth.is_merchant() TO authenticated;
GRANT EXECUTE ON FUNCTION check_database_connection() TO authenticated;