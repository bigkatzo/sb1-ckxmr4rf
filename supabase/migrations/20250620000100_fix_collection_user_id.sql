-- Start transaction
BEGIN;

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS ensure_collection_user_id ON collections;
DROP FUNCTION IF EXISTS set_collection_user_id();

-- Create updated trigger function with proper security context
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
CREATE TRIGGER ensure_collection_user_id
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION set_collection_user_id();

-- Verify trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'ensure_collection_user_id'
  ) THEN
    RAISE EXCEPTION 'Trigger not created properly';
  END IF;
END $$;

COMMIT; 