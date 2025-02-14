-- Add owner columns to storage.objects
ALTER TABLE storage.objects
  ADD COLUMN owner uuid REFERENCES auth.users(id),
  ADD COLUMN owner_id uuid REFERENCES auth.users(id);

-- Create index for owner columns
CREATE INDEX IF NOT EXISTS objects_owner_idx ON storage.objects(owner);
CREATE INDEX IF NOT EXISTS objects_owner_id_idx ON storage.objects(owner_id);

-- Get admin420's user ID
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local'
  LIMIT 1;

  -- Update existing objects to set admin420 as owner
  UPDATE storage.objects
  SET 
    owner = v_admin_id,
    owner_id = v_admin_id;
END $$;

-- Drop existing policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "public_read" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_write" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_update" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create new policies that check ownership
CREATE POLICY "public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "authenticated_write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('collection-images', 'product-images')
    AND (
      auth.uid() = owner 
      OR EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND email = 'admin420@merchant.local'
      )
    )
  );

CREATE POLICY "authenticated_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('collection-images', 'product-images')
    AND (
      auth.uid() = owner 
      OR EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND email = 'admin420@merchant.local'
      )
    )
  );

CREATE POLICY "authenticated_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('collection-images', 'product-images')
    AND (
      auth.uid() = owner 
      OR EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND email = 'admin420@merchant.local'
      )
    )
  );

-- Create trigger to automatically set owner on insert
CREATE OR REPLACE FUNCTION storage.set_object_owner()
RETURNS trigger AS $$
BEGIN
  NEW.owner := auth.uid();
  NEW.owner_id := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_object_owner_trigger ON storage.objects;
CREATE TRIGGER set_object_owner_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION storage.set_object_owner();