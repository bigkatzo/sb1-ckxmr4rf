-- Start transaction
BEGIN;

-- Drop any remaining triggers or functions that reference 'owner'
DROP TRIGGER IF EXISTS set_collection_owner ON collections;
DROP TRIGGER IF EXISTS set_product_owner ON products;
DROP FUNCTION IF EXISTS set_owner() CASCADE;

-- Update any remaining RLS policies to use user_id instead of owner
DROP POLICY IF EXISTS "Collections access" ON collections;
CREATE POLICY "Collections access"
  ON collections
  USING (
    visible = true 
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Verify no references to owner remain
DO $$
BEGIN
  -- Check if any owner columns exist
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'collections'
    AND column_name IN ('owner', 'owner_id')
  ) THEN
    RAISE EXCEPTION 'Owner columns still exist in collections table';
  END IF;

  -- Check if any triggers with owner in the name exist
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname LIKE '%owner%'
    AND NOT tgname IN ('auto_grant_owner_access')
  ) THEN
    RAISE EXCEPTION 'Found triggers with owner in name';
  END IF;

  -- Check if any functions with owner in the name exist
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname LIKE '%owner%'
    AND proname NOT IN ('grant_owner_collection_access', 'collection_owner_id')
  ) THEN
    RAISE EXCEPTION 'Found functions with owner in name';
  END IF;
END $$;

COMMIT; 