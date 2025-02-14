-- First drop all dependent triggers and functions in correct order
DROP TRIGGER IF EXISTS validate_category_ownership ON categories;
DROP TRIGGER IF EXISTS validate_collection_ownership ON collections;
DROP TRIGGER IF EXISTS validate_product_ownership ON products;
DROP FUNCTION IF EXISTS validate_collection_ownership() CASCADE;
DROP FUNCTION IF EXISTS validate_product_ownership() CASCADE;

-- Disable RLS temporarily
ALTER TABLE collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- Add owner columns to collections and products
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS owner uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS owner uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

-- Create indexes for owner columns
CREATE INDEX IF NOT EXISTS idx_collections_owner ON collections(owner);
CREATE INDEX IF NOT EXISTS idx_collections_owner_id ON collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_owner ON products(owner);
CREATE INDEX IF NOT EXISTS idx_products_owner_id ON products(owner_id);

-- Get admin420's user ID and assign ownership
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get admin420's user ID
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found';
  END IF;

  -- Update collections
  UPDATE collections
  SET 
    owner = v_admin_id,
    owner_id = v_admin_id
  WHERE owner IS NULL OR owner_id IS NULL;

  -- Update products
  UPDATE products
  SET 
    owner = v_admin_id,
    owner_id = v_admin_id
  WHERE owner IS NULL OR owner_id IS NULL;
END $$;

-- Create function to set owner on insert
CREATE OR REPLACE FUNCTION set_owner()
RETURNS trigger AS $$
BEGIN
  NEW.owner := COALESCE(NEW.owner, auth.uid());
  NEW.owner_id := COALESCE(NEW.owner_id, auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for collections and products
DROP TRIGGER IF EXISTS set_collection_owner ON collections;
CREATE TRIGGER set_collection_owner
  BEFORE INSERT ON collections
  FOR EACH ROW
  EXECUTE FUNCTION set_owner();

DROP TRIGGER IF EXISTS set_product_owner ON products;
CREATE TRIGGER set_product_owner
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION set_owner();

-- Re-enable RLS with updated policies
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Update RLS policies to include owner checks
DROP POLICY IF EXISTS "Collections access" ON collections;
CREATE POLICY "Collections access"
  ON collections
  USING (
    visible = true 
    OR auth.uid() = user_id
    OR auth.uid() = owner
    OR auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email = 'admin420@merchant.local'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = owner
    OR auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND email = 'admin420@merchant.local'
    )
  );

DROP POLICY IF EXISTS "Products access" ON products;
CREATE POLICY "Products access"
  ON products
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.visible = true 
        OR c.user_id = auth.uid()
        OR c.owner = auth.uid()
        OR c.owner_id = auth.uid()
        OR products.owner = auth.uid()
        OR products.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM auth.users
          WHERE id = auth.uid()
          AND email = 'admin420@merchant.local'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.user_id = auth.uid()
        OR c.owner = auth.uid()
        OR c.owner_id = auth.uid()
        OR auth.uid() = products.owner
        OR auth.uid() = products.owner_id
        OR EXISTS (
          SELECT 1 FROM auth.users
          WHERE id = auth.uid()
          AND email = 'admin420@merchant.local'
        )
      )
    )
  );