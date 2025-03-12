-- Add visible column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT true;

-- Drop existing policies
DROP POLICY IF EXISTS "products_view" ON products;
DROP POLICY IF EXISTS "products_edit" ON products;
DROP POLICY IF EXISTS "products_view_policy" ON products;
DROP POLICY IF EXISTS "products_edit_policy" ON products;
DROP POLICY IF EXISTS "products_storefront_view" ON products;

-- Create RLS policies for products
CREATE POLICY "products_view_policy"
ON public.products
FOR SELECT
TO authenticated
USING (
  -- Users can view products in collections they have access to
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND (
      c.visible = true
      OR c.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM collection_access ca
        WHERE ca.collection_id = c.id
        AND ca.user_id = auth.uid()
        AND ca.access_type IN ('view', 'edit')
      )
      OR auth.is_admin()
    )
  )
);

CREATE POLICY "products_edit_policy"
ON public.products
FOR ALL
TO authenticated
USING (
  -- Users can modify products in collections they own
  EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  )
  OR
  -- Users with edit access can modify products
  EXISTS (
    SELECT 1 FROM collection_access
    WHERE collection_id = products.collection_id
    AND user_id = auth.uid()
    AND access_type = 'edit'
  )
  OR
  -- Admins can modify all products
  auth.is_admin()
);

-- Create storefront policy for public access
CREATE POLICY "products_storefront_view"
ON products
FOR SELECT
TO public
USING (
  -- Only show products that are visible and in visible collections
  visible = true
  AND EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND c.visible = true
  )
); 