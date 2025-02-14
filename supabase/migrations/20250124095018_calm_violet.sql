-- Drop existing functions and triggers first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS ensure_all_user_profiles() CASCADE;
  DROP FUNCTION IF EXISTS create_user_profile_on_signup() CASCADE;
  DROP FUNCTION IF EXISTS grant_collection_access(uuid, uuid, text) CASCADE;
  DROP FUNCTION IF EXISTS revoke_collection_access(uuid, uuid) CASCADE;
  DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create function to ensure all users have profiles
CREATE OR REPLACE FUNCTION ensure_all_user_profiles()
RETURNS void AS $$
BEGIN
  -- Insert missing user profiles
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
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to ensure user profile is created on user creation
CREATE OR REPLACE FUNCTION create_user_profile_on_signup()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (id, role)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
      WHEN NEW.raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
      ELSE 'user'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile_on_signup();

-- Create function to grant collection access
CREATE OR REPLACE FUNCTION grant_collection_access(
  collection_id uuid,
  user_id uuid,
  access_type text
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin or collection owner
  IF NOT (
    auth.is_admin() OR 
    EXISTS (
      SELECT 1 FROM collections 
      WHERE id = collection_id 
      AND user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Only admin or collection owner can grant access';
  END IF;

  -- Validate access type
  IF access_type NOT IN ('view', 'manage') THEN
    RAISE EXCEPTION 'Invalid access type. Must be view or manage';
  END IF;

  -- Grant access
  INSERT INTO collection_access (
    collection_id,
    user_id,
    access_type,
    granted_by
  )
  VALUES (
    collection_id,
    user_id,
    access_type,
    auth.uid()
  )
  ON CONFLICT (collection_id, user_id) 
  DO UPDATE SET 
    access_type = EXCLUDED.access_type,
    granted_by = EXCLUDED.granted_by;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to revoke collection access
CREATE OR REPLACE FUNCTION revoke_collection_access(
  collection_id uuid,
  user_id uuid
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin or collection owner
  IF NOT (
    auth.is_admin() OR 
    EXISTS (
      SELECT 1 FROM collections 
      WHERE id = collection_id 
      AND user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Only admin or collection owner can revoke access';
  END IF;

  -- Revoke access
  DELETE FROM collection_access
  WHERE collection_id = collection_id
  AND user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for collection_access
DROP POLICY IF EXISTS "collection_access_policy" ON collection_access;
CREATE POLICY "collection_access_policy"
  ON collection_access
  FOR ALL
  TO authenticated
  USING (
    -- Users can view their own access
    user_id = auth.uid()
    OR
    -- Collection owners can view access to their collections
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Admin can view all
    auth.is_admin()
  )
  WITH CHECK (
    -- Only collection owners and admin can modify
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id
      AND (
        c.user_id = auth.uid()
        OR auth.is_admin()
      )
    )
  );

-- Run initial profile creation for existing users
SELECT ensure_all_user_profiles();

-- Grant necessary permissions
GRANT ALL ON collection_access TO authenticated;
GRANT EXECUTE ON FUNCTION grant_collection_access(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_collection_access(uuid, uuid) TO authenticated;