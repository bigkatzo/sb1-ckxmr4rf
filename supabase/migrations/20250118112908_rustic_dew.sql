-- Drop existing policies and functions
DO $$ BEGIN
  DROP POLICY IF EXISTS "collections_policy" ON collections;
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
  DROP FUNCTION IF EXISTS auth.get_collection_access(uuid) CASCADE;
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS ensure_user_profile() CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simplified admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check collection access level
CREATE OR REPLACE FUNCTION auth.get_collection_access(collection_id uuid)
RETURNS text AS $$
BEGIN
  -- Admin has full access
  IF auth.is_admin() THEN
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
  RETURN COALESCE(
    (
      SELECT access_type 
      FROM collection_access
      WHERE collection_id = collection_id
      AND user_id = auth.uid()
    ),
    'none'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to ensure user profile exists
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS trigger AS $$
BEGIN
  -- Create profile for new user if it doesn't exist
  INSERT INTO user_profiles (id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (id) DO UPDATE 
  SET role = CASE 
    WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
    ELSE EXCLUDED.role
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
CREATE TRIGGER ensure_user_profile_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_profile();

-- Create RLS policies for collections
CREATE POLICY "collections_policy"
  ON collections
  FOR ALL
  TO authenticated
  USING (
    -- Anyone authenticated can view public collections
    visible = true 
    OR 
    -- Or collections they own/have access to
    auth.get_collection_access(id) != 'none'
    OR
    -- Or they are the owner
    user_id = auth.uid()
  )
  WITH CHECK (
    -- Any authenticated user can create/modify their own collections
    user_id = auth.uid()
    OR
    -- Or they have manage access
    auth.get_collection_access(id) = 'manage'
  );

-- Create RLS policies for products
CREATE POLICY "products_policy"
  ON products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        -- Anyone can view products in public collections
        c.visible = true 
        OR 
        -- Or products in collections they own/have access to
        auth.get_collection_access(c.id) != 'none'
        OR
        -- Or they own the collection
        c.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        -- Can modify if they own the collection
        c.user_id = auth.uid()
        OR
        -- Or have manage access
        auth.get_collection_access(c.id) = 'manage'
      )
    )
  );

-- Create RLS policies for categories
CREATE POLICY "categories_policy"
  ON categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        -- Anyone can view categories in public collections
        c.visible = true 
        OR 
        -- Or categories in collections they own/have access to
        auth.get_collection_access(c.id) != 'none'
        OR
        -- Or they own the collection
        c.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        -- Can modify if they own the collection
        c.user_id = auth.uid()
        OR
        -- Or have manage access
        auth.get_collection_access(c.id) = 'manage'
      )
    )
  );

-- Ensure all existing users have profiles
INSERT INTO user_profiles (id, role)
SELECT 
  u.id,
  CASE 
    WHEN u.email = 'admin420@merchant.local' THEN 'admin'
    ELSE 'user'
  END as role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO UPDATE 
SET role = CASE 
  WHEN EXCLUDED.id IN (SELECT id FROM auth.users WHERE email = 'admin420@merchant.local') THEN 'admin'
  ELSE EXCLUDED.role
END;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_collection_access(uuid) TO authenticated;
GRANT ALL ON collections TO authenticated;
GRANT ALL ON products TO authenticated;
GRANT ALL ON categories TO authenticated;
GRANT ALL ON user_profiles TO authenticated;