-- Drop any existing admin-related functions
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Create admin check function that only recognizes admin420
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT email = 'admin420@merchant.local'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get admin user ID
CREATE OR REPLACE FUNCTION auth.get_admin_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT id FROM auth.users
    WHERE email = 'admin420@merchant.local'
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to give admin420 full access to collections
DROP POLICY IF EXISTS "Collection view policy" ON collections;
DROP POLICY IF EXISTS "Collection manage policy" ON collections;

-- Create new collection policies that prioritize admin access
CREATE POLICY "Collection view policy"
  ON collections FOR SELECT
  USING (
    visible = true 
    OR auth.is_admin() 
    OR user_id = auth.uid()
  );

CREATE POLICY "Collection manage policy"
  ON collections FOR ALL
  TO authenticated
  USING (
    auth.is_admin() 
    OR user_id = auth.uid()
  )
  WITH CHECK (
    -- Allow admin to set any user_id, but force regular users to use their own
    CASE 
      WHEN auth.is_admin() THEN true
      ELSE user_id = auth.uid()
    END
  );

-- Create trigger to set user_id for admin
CREATE OR REPLACE FUNCTION set_collection_user_id()
RETURNS trigger AS $$
BEGIN
  -- If user is admin and no user_id specified, set it to admin's ID
  IF auth.is_admin() AND NEW.user_id IS NULL THEN
    NEW.user_id := auth.get_admin_id();
  -- For regular users, always set to their own ID
  ELSIF NOT auth.is_admin() THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce user_id setting
DROP TRIGGER IF EXISTS ensure_collection_user_id ON collections;
CREATE TRIGGER ensure_collection_user_id
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION set_collection_user_id();