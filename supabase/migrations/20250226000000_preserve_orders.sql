-- Start transaction
BEGIN;

-- First, drop the existing foreign key constraints
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_product_id_fkey,
DROP CONSTRAINT IF EXISTS orders_collection_id_fkey;

-- Re-add the foreign key constraints with ON DELETE SET NULL
-- This will preserve the order but set the references to NULL when products/collections are deleted
ALTER TABLE orders
ADD CONSTRAINT orders_product_id_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES products(id) 
  ON DELETE SET NULL,
ADD CONSTRAINT orders_collection_id_fkey 
  FOREIGN KEY (collection_id) 
  REFERENCES collections(id) 
  ON DELETE SET NULL;

-- Make product_id and collection_id nullable since they can now be NULL
ALTER TABLE orders
ALTER COLUMN product_id DROP NOT NULL,
ALTER COLUMN collection_id DROP NOT NULL;

-- Add columns to store product and collection info at time of purchase
-- This ensures we keep the important information even if the original records are deleted
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS product_snapshot jsonb,
ADD COLUMN IF NOT EXISTS collection_snapshot jsonb;

-- Create a trigger to automatically save snapshots when an order is created
CREATE OR REPLACE FUNCTION save_order_snapshots()
RETURNS trigger AS $$
BEGIN
  -- Save product snapshot
  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'sku', p.sku,
    'description', p.description,
    'images', p.images,
    'variants', p.variants,
    'variant_prices', p.variant_prices,
    'category', (SELECT jsonb_build_object('id', c.id, 'name', c.name) FROM categories c WHERE c.id = p.category_id)
  ) INTO NEW.product_snapshot
  FROM products p
  WHERE p.id = NEW.product_id;

  -- Save collection snapshot
  SELECT jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'description', c.description,
    'owner_id', c.user_id
  ) INTO NEW.collection_snapshot
  FROM collections c
  WHERE c.id = NEW.collection_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_snapshot_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION save_order_snapshots();

-- Update existing orders to include snapshots
UPDATE orders o
SET 
  product_snapshot = (
    SELECT jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'sku', p.sku,
      'description', p.description,
      'images', p.images,
      'variants', p.variants,
      'variant_prices', p.variant_prices,
      'category', (SELECT jsonb_build_object('id', c.id, 'name', c.name) FROM categories c WHERE c.id = p.category_id)
    )
    FROM products p
    WHERE p.id = o.product_id
  ),
  collection_snapshot = (
    SELECT jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'description', c.description,
      'owner_id', c.user_id
    )
    FROM collections c
    WHERE c.id = o.collection_id
  )
WHERE o.product_snapshot IS NULL OR o.collection_snapshot IS NULL;

-- Update views that depend on orders table
CREATE OR REPLACE VIEW user_orders AS
SELECT 
    o.id,
    o.order_number,
    o.collection_id,
    o.product_id,
    o.wallet_address,
    o.transaction_signature,
    o.shipping_address,
    o.contact_info,
    o.status,
    o.amount_sol,
    o.created_at,
    o.updated_at,
    o.variant_selections as order_variants,
    COALESCE(p.name, o.product_snapshot->>'name') as product_name,
    COALESCE(p.variants, o.product_snapshot->'variants') as product_variants,
    COALESCE(p.variant_prices, o.product_snapshot->'variant_prices') as product_variant_prices,
    COALESCE(p.images, o.product_snapshot->'images') as product_images,
    COALESCE(p.sku, o.product_snapshot->>'sku') as product_sku,
    COALESCE(c.name, o.collection_snapshot->>'name') as collection_name
FROM orders o
LEFT JOIN products p ON p.id = o.product_id
LEFT JOIN collections c ON c.id = o.collection_id;

COMMIT; 