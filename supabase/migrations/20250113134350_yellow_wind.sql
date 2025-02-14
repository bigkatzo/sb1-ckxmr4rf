-- Create function to check collection access
CREATE OR REPLACE FUNCTION auth.has_collection_access(collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (
    -- Admin has access to everything
    auth.is_admin()
    OR
    -- Merchant has access to own collections
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND user_id = auth.uid()
    )
    OR
    -- Intern has access to assigned collections
    EXISTS (
      SELECT 1 FROM collection_assignments
      WHERE collection_id = collection_id
      AND user_id = auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;