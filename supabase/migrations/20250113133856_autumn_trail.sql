-- Grant admin permissions to admin420 user
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

-- Update RLS policies to include admin access
CREATE OR REPLACE FUNCTION public.is_owner_or_admin(collection_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid() = collection_user_id OR auth.is_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update collections policies
DROP POLICY IF EXISTS "Collections access" ON collections;
CREATE POLICY "Collections access"
  ON collections
  USING (
    visible = true 
    OR is_owner_or_admin(user_id)
  )
  WITH CHECK (
    is_owner_or_admin(user_id)
  );

-- Update products policies
DROP POLICY IF EXISTS "Products access" ON products;
CREATE POLICY "Products access"
  ON products
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id 
      AND (c.visible = true OR is_owner_or_admin(c.user_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id 
      AND is_owner_or_admin(c.user_id)
    )
  );

-- Update categories policies
DROP POLICY IF EXISTS "Categories access" ON categories;
CREATE POLICY "Categories access"
  ON categories
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id 
      AND (c.visible = true OR is_owner_or_admin(c.user_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id 
      AND is_owner_or_admin(c.user_id)
    )
  );

-- Update storage policies to allow admin access
DROP POLICY IF EXISTS "Storage public read" ON storage.objects;
DROP POLICY IF EXISTS "Storage authenticated write" ON storage.objects;
DROP POLICY IF EXISTS "Storage authenticated modify" ON storage.objects;

CREATE POLICY "Storage access"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id IN ('collection-images', 'product-images')
    AND (
      auth.role() = 'authenticated' 
      OR auth.is_admin()
    )
  )
  WITH CHECK (
    bucket_id IN ('collection-images', 'product-images')
    AND (
      auth.role() = 'authenticated'
      OR auth.is_admin()
    )
  );