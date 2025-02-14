-- Drop existing functions and triggers first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.get_collection_access(uuid) CASCADE;
  DROP FUNCTION IF EXISTS ensure_user_profile() CASCADE;
  DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simplified admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Use direct email check with proper null handling
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

-- Create function to handle new user setup
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Extract username from email (remove @merchant.local)
  NEW.username := split_part(NEW.email, '@', 1);
  
  -- Set raw_app_meta_data
  NEW.raw_app_meta_data := jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', NEW.username
  );
  
  -- Set raw_user_meta_data
  NEW.raw_user_meta_data := jsonb_build_object(
    'username', NEW.username
  );
  
  -- Set email_confirmed_at for immediate access
  NEW.email_confirmed_at := now();
  
  -- Set role to authenticated
  NEW.role := 'authenticated';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Create trigger function to ensure user profile exists
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS trigger AS $$
BEGIN
  -- Create or update profile
  INSERT INTO user_profiles (id, role)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
      WHEN NEW.raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO UPDATE 
  SET role = CASE 
    WHEN EXCLUDED.id IN (SELECT id FROM auth.users WHERE email = 'admin420@merchant.local') THEN 'admin'
    WHEN NEW.raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
    ELSE EXCLUDED.role
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user profile management
CREATE TRIGGER ensure_user_profile_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_profile();

-- Create function to check database connection
CREATE OR REPLACE FUNCTION check_database_connection()
RETURNS boolean AS $$
BEGIN
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure all existing users have profiles
INSERT INTO user_profiles (id, role)
SELECT 
  u.id,
  CASE 
    WHEN u.email = 'admin420@merchant.local' THEN 'admin'
    WHEN u.raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
    ELSE 'user'
  END as role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO UPDATE 
SET role = CASE 
  WHEN EXCLUDED.id IN (SELECT id FROM auth.users WHERE email = 'admin420@merchant.local') THEN 'admin'
  WHEN (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = EXCLUDED.id) = 'merchant' THEN 'merchant'
  ELSE EXCLUDED.role
END;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_collection_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_database_connection() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

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

-- Create RLS policies for products and categories
CREATE POLICY "products_policy"
  ON products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.visible = true 
        OR auth.get_collection_access(c.id) != 'none'
        OR c.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.user_id = auth.uid()
        OR auth.get_collection_access(c.id) = 'manage'
      )
    )
  );

CREATE POLICY "categories_policy"
  ON categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.visible = true 
        OR auth.get_collection_access(c.id) != 'none'
        OR c.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.user_id = auth.uid()
        OR auth.get_collection_access(c.id) = 'manage'
      )
    )
  );