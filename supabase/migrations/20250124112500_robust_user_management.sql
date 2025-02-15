-- Drop existing types and functions for clean recreation
DO $$ BEGIN
  DROP TYPE IF EXISTS user_role CASCADE;
  DROP TYPE IF EXISTS access_level CASCADE;
  DROP FUNCTION IF EXISTS admin_create_user(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS admin_list_users() CASCADE;
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.has_merchant_access() CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create improved role and access types
CREATE TYPE user_role AS ENUM ('admin', 'merchant', 'user');
CREATE TYPE access_level AS ENUM ('none', 'view', 'manage');

-- Create user profile management functions
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'::user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.has_merchant_access()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin'::user_role, 'merchant'::user_role)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check collection access
CREATE OR REPLACE FUNCTION auth.check_collection_access(collection_id uuid)
RETURNS access_level AS $$
DECLARE
  v_access access_level;
BEGIN
  -- Admins have full access
  IF auth.is_admin() THEN
    RETURN 'manage'::access_level;
  END IF;

  -- Check if user owns the collection
  IF EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  ) THEN
    RETURN 'manage'::access_level;
  END IF;

  -- Check explicit access level
  SELECT access_type INTO v_access
  FROM collection_access
  WHERE collection_id = collection_id
  AND user_id = auth.uid();

  RETURN COALESCE(v_access, 'none'::access_level);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to manage user access
CREATE OR REPLACE FUNCTION admin_create_user(
  p_email text,
  p_password text,
  p_role user_role DEFAULT 'user'::user_role,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  user_id uuid,
  email text,
  role user_role
) AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create users';
  END IF;

  -- Validate email
  IF NOT (p_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  -- Validate password strength
  IF LENGTH(p_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long';
  END IF;

  -- Create user with proper metadata
  INSERT INTO auth.users (
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object(
      'role', p_role,
      'provider', 'email',
      'providers', ARRAY['email']
    ) || p_metadata,
    jsonb_build_object('role', p_role) || p_metadata,
    'authenticated',
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  -- Create user profile
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, p_role);

  RETURN QUERY
  SELECT 
    v_user_id,
    p_email,
    p_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to grant collection access
CREATE OR REPLACE FUNCTION admin_grant_collection_access(
  p_user_id uuid,
  p_collection_id uuid,
  p_access_type access_level DEFAULT 'view'::access_level
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
    RAISE EXCEPTION 'Insufficient permissions to grant collection access';
  END IF;

  -- Verify user exists and can receive access
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = p_user_id
  ) THEN
    RAISE EXCEPTION 'User does not exist';
  END IF;

  -- Grant access
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
    granted_by = EXCLUDED.granted_by,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to list users with details
CREATE OR REPLACE FUNCTION admin_list_users(
  p_search text DEFAULT NULL,
  p_role user_role DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  role user_role,
  created_at timestamptz,
  collection_count bigint,
  last_active timestamptz,
  metadata jsonb
) AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(p.role, 'user'::user_role),
    u.created_at,
    COUNT(DISTINCT c.id) as collection_count,
    u.last_sign_in_at as last_active,
    u.raw_app_meta_data as metadata
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  LEFT JOIN collections c ON c.user_id = u.id
  WHERE 
    (p_search IS NULL OR 
     u.email ILIKE '%' || p_search || '%') AND
    (p_role IS NULL OR p_role = p.role)
  GROUP BY u.id, u.email, p.role, u.created_at, u.last_sign_in_at, u.raw_app_meta_data
  ORDER BY u.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's collection access
CREATE OR REPLACE FUNCTION get_user_collection_access(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  collection_id uuid,
  collection_name text,
  access_type access_level,
  granted_by_email text,
  granted_at timestamptz
) AS $$
BEGIN
  -- Verify caller is admin or the user themselves
  IF NOT (auth.is_admin() OR auth.uid() = p_user_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    c.id as collection_id,
    c.name as collection_name,
    ca.access_type,
    u.email as granted_by_email,
    ca.created_at as granted_at
  FROM collections c
  LEFT JOIN collection_access ca ON ca.collection_id = c.id
  LEFT JOIN auth.users u ON u.id = ca.granted_by
  WHERE 
    c.user_id = p_user_id OR
    ca.user_id = p_user_id
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR auth.is_admin());

CREATE POLICY "user_profiles_admin_policy" ON user_profiles
  FOR ALL TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Collection access policies
CREATE POLICY "collection_access_select_policy" ON collection_access
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR 
    auth.is_admin() OR
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "collection_access_admin_merchant_policy" ON collection_access
  FOR ALL TO authenticated
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_merchant_access() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.check_collection_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_user(text, text, user_role, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_grant_collection_access(uuid, uuid, access_level) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_users(text, user_role, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_collection_access(uuid) TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_collection_access_user_id ON collection_access(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_access_collection_id ON collection_access(collection_id);
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);

-- Update existing users to ensure they have profiles
INSERT INTO user_profiles (id, role)
SELECT 
  id,
  COALESCE(
    (raw_app_meta_data->>'role')::user_role,
    'user'::user_role
  ) as role
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role; 