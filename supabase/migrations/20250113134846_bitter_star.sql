-- Drop existing policies first
DROP POLICY IF EXISTS "User permissions read" ON user_permissions;
DROP POLICY IF EXISTS "User permissions write" ON user_permissions;
DROP POLICY IF EXISTS "Collection assignments read" ON collection_assignments;
DROP POLICY IF EXISTS "Collection assignments write" ON collection_assignments;

-- Create policies for user_permissions with unique names
CREATE POLICY "Permission view policy"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (
    auth.is_admin()
    OR user_id = auth.uid()
  );

CREATE POLICY "Permission manage policy"
  ON user_permissions FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Create policies for collection_assignments with unique names
CREATE POLICY "Assignment view policy"
  ON collection_assignments FOR SELECT
  TO authenticated
  USING (
    auth.is_admin()
    OR user_id = auth.uid()
    OR assigned_by = auth.uid()
  );

CREATE POLICY "Assignment manage policy"
  ON collection_assignments FOR ALL
  TO authenticated
  USING (auth.is_merchant())
  WITH CHECK (auth.is_merchant());