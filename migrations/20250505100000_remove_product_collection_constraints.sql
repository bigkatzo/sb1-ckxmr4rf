-- Migration: Remove Product and Collection FK Constraints without Breaking Views
-- This script will modify the orders table to allow product and collection deletion
-- while preserving order data integrity and maintain all existing views.

BEGIN;

-- 1. Backup existing views so we can recreate them later
-- Temporarily store view definitions
DO $$
DECLARE
    merchant_orders_def text;
    user_orders_def text;
    public_order_counts_def text;
BEGIN
    -- Capture the current view definitions before dropping
    SELECT pg_get_viewdef('merchant_orders'::regclass, true) INTO merchant_orders_def;
    SELECT pg_get_viewdef('user_orders'::regclass, true) INTO user_orders_def;
    SELECT pg_get_viewdef('public_order_counts'::regclass, true) INTO public_order_counts_def;
    
    -- Store for later reference if needed
    CREATE TEMP TABLE view_definitions (
        view_name text PRIMARY KEY,
        definition text
    );
    
    INSERT INTO view_definitions VALUES
        ('merchant_orders', merchant_orders_def),
        ('user_orders', user_orders_def),
        ('public_order_counts', public_order_counts_def);
END $$;

-- 2. Drop dependent views for modification
DROP VIEW IF EXISTS merchant_orders CASCADE;
DROP VIEW IF EXISTS user_orders CASCADE;
DROP VIEW IF EXISTS public_order_counts CASCADE;

-- 3. Drop the foreign key constraints
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_product_id_fkey,
DROP CONSTRAINT IF EXISTS orders_collection_id_fkey;

-- 4. Allow NULL values for product_id and collection_id
ALTER TABLE orders
ALTER COLUMN product_id DROP NOT NULL,
ALTER COLUMN collection_id DROP NOT NULL;

-- 5. Ensure snapshot columns exist
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS product_snapshot jsonb,
ADD COLUMN IF NOT EXISTS collection_snapshot jsonb;

-- 6. Create or update the snapshot trigger function
CREATE OR REPLACE FUNCTION save_order_snapshots()
RETURNS trigger AS $$
BEGIN
  -- Save product snapshot (if product exists)
  IF NEW.product_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'sku', p.sku,
      'description', p.description,
      'images', p.images,
      'variants', p.variants,
      'variant_prices', p.variant_prices,
      'category', (
        SELECT jsonb_build_object('id', c.id, 'name', c.name) 
        FROM categories c 
        WHERE c.id = p.category_id
      )
    ) INTO NEW.product_snapshot
    FROM products p
    WHERE p.id = NEW.product_id;
  END IF;

  -- Save collection snapshot (if collection exists)
  IF NEW.collection_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'description', c.description,
      'owner_id', c.user_id
    ) INTO NEW.collection_snapshot
    FROM collections c
    WHERE c.id = NEW.collection_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create the trigger if it doesn't exist, otherwise it will continue to use the existing one
DROP TRIGGER IF EXISTS orders_snapshot_trigger ON orders;
CREATE TRIGGER orders_snapshot_trigger
  BEFORE INSERT OR UPDATE OF product_id, collection_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION save_order_snapshots();

-- 8. Update existing orders to include snapshots if they don't have them
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
      'category', (
        SELECT jsonb_build_object('id', c.id, 'name', c.name) 
        FROM categories c 
        WHERE c.id = p.category_id
      )
    )
    FROM products p
    WHERE p.id = o.product_id
  )
WHERE o.product_id IS NOT NULL AND o.product_snapshot IS NULL;

UPDATE orders o
SET 
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
WHERE o.collection_id IS NOT NULL AND o.collection_snapshot IS NULL;

-- 9. Recreate the user_orders view with fallback to snapshots
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
    o.variant_selections,
    o.payment_metadata,
    -- Use product snapshot as fallback
    COALESCE(p.name, o.product_snapshot->>'name') as product_name,
    COALESCE(p.sku, o.product_snapshot->>'sku') as product_sku,
    COALESCE(p.variants, o.product_snapshot->'variants') as product_variants,
    COALESCE(p.variant_prices, o.product_snapshot->'variant_prices') as product_variant_prices,
    -- Fix image handling to ensure it always works correctly
    CASE 
        WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images
        WHEN o.product_snapshot->'images' IS NOT NULL AND jsonb_array_length(o.product_snapshot->'images') > 0 THEN
            ARRAY(
                SELECT jsonb_array_elements_text(o.product_snapshot->'images')
            )
        ELSE '{}'::text[]
    END as product_images,
    -- Use collection snapshot as fallback
    COALESCE(c.name, o.collection_snapshot->>'name') as collection_name,
    -- Include tracking data if available
    CASE 
        WHEN t.id IS NOT NULL THEN 
            jsonb_build_object(
                'id', t.id,
                'order_id', t.order_id,
                'tracking_number', t.tracking_number,
                'carrier', t.carrier,
                'status', t.status,
                'status_details', t.status_details,
                'estimated_delivery_date', t.estimated_delivery_date,
                'last_update', t.last_update,
                'created_at', t.created_at,
                'updated_at', t.updated_at
            )
        ELSE NULL
    END as tracking,
    -- Include the entire snapshots for frontend use
    o.product_snapshot,
    o.collection_snapshot
FROM orders o
LEFT JOIN products p ON p.id = o.product_id
LEFT JOIN collections c ON c.id = o.collection_id
LEFT JOIN order_tracking t ON t.order_id = o.id;

-- 10. Recreate the merchant_orders view with fallback to snapshots
CREATE OR REPLACE VIEW merchant_orders AS
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
    o.payment_metadata,
    -- Use product snapshot as fallback
    COALESCE(p.name, o.product_snapshot->>'name') as product_name,
    COALESCE(p.sku, o.product_snapshot->>'sku') as product_sku,
    -- Fix image URL to ensure it's always available
    CASE
        WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN p.images[1]
        WHEN o.product_snapshot->'images' IS NOT NULL AND jsonb_array_length(o.product_snapshot->'images') > 0 THEN
            o.product_snapshot->'images'->>0
        ELSE NULL
    END as product_image_url,
    COALESCE(p.variants, o.product_snapshot->'variants') as product_variants,
    COALESCE(p.variant_prices, o.product_snapshot->'variant_prices') as product_variant_prices,
    -- Use collection snapshot as fallback
    COALESCE(c.name, o.collection_snapshot->>'name') as collection_name,
    COALESCE(c.user_id, (o.collection_snapshot->>'owner_id')::uuid) as collection_owner_id,
    -- Always get category name if available
    cat.name as category_name,
    -- Determine access type
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role = 'admin'
        ) THEN 'admin'
        WHEN c.user_id = auth.uid() THEN 'owner'
        WHEN ca.access_type IS NOT NULL THEN ca.access_type
        ELSE NULL
    END as access_type,
    -- Include tracking data
    CASE 
        WHEN t.id IS NOT NULL THEN 
            jsonb_build_object(
                'id', t.id,
                'order_id', t.order_id,
                'tracking_number', t.tracking_number,
                'carrier', t.carrier,
                'status', t.status,
                'status_details', t.status_details,
                'estimated_delivery_date', t.estimated_delivery_date,
                'last_update', t.last_update,
                'created_at', t.created_at,
                'updated_at', t.updated_at
            )
        ELSE NULL
    END as tracking,
    -- Include snapshots in the view for reference
    o.product_snapshot,
    o.collection_snapshot
FROM orders o
LEFT JOIN products p ON p.id = o.product_id
LEFT JOIN collections c ON c.id = o.collection_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
LEFT JOIN categories cat ON cat.id = p.category_id OR (o.product_snapshot->'category'->>'id')::uuid = cat.id
LEFT JOIN order_tracking t ON t.order_id = o.id
WHERE
    -- Only show orders that match the access rules
    EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
    OR
    -- Collection owner (check live and snapshot)
    (c.user_id = auth.uid() OR (o.collection_snapshot->>'owner_id')::uuid = auth.uid())
    OR
    -- Access through collection_access
    EXISTS (
        SELECT 1 FROM collection_access ca2
        WHERE (ca2.collection_id = c.id OR ca2.collection_id = (o.collection_snapshot->>'id')::uuid)
        AND ca2.user_id = auth.uid()
        AND ca2.access_type IN ('view', 'edit')
    );

-- 11. Recreate the public_order_counts view (no need for snapshots here as it's just counts)
CREATE OR REPLACE VIEW public_order_counts AS
SELECT 
    p.id as product_id,
    p.collection_id,
    COUNT(o.id) as total_orders
FROM products p
LEFT JOIN orders o ON o.product_id = p.id
WHERE EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = p.collection_id
    AND c.visible = true
)
GROUP BY p.id, p.collection_id;

-- 12. Ensure RLS policies are still intact
DO $$ 
BEGIN
    -- Verify the orders_count_public_view policy exists, if not recreate it
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'orders_count_public_view'
    ) THEN
        CREATE POLICY "orders_count_public_view"
        ON orders
        FOR SELECT
        TO public
        USING (
            EXISTS (
                SELECT 1 FROM collections c
                WHERE c.id = collection_id
                AND c.visible = true
            )
        );
    END IF;
    
    -- Verify the orders_user_view policy exists, if not recreate it
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'orders_user_view'
    ) THEN
        CREATE POLICY "orders_user_view"
        ON orders
        FOR SELECT
        TO authenticated
        USING (
            wallet_address = auth.jwt()->>'wallet_address'
        );
    END IF;
END $$;

-- 13. Grant necessary permissions
GRANT SELECT ON merchant_orders TO authenticated;
GRANT SELECT ON user_orders TO authenticated;
GRANT SELECT ON public_order_counts TO public;

-- 14. Add documentation for the changes
COMMENT ON COLUMN orders.product_snapshot IS 'Snapshot of product data at the time of order creation, used as fallback if product is deleted';
COMMENT ON COLUMN orders.collection_snapshot IS 'Snapshot of collection data at the time of order creation, used as fallback if collection is deleted';
COMMENT ON VIEW user_orders IS 'View of orders for authenticated users, with fallback to snapshots if original records are deleted';
COMMENT ON VIEW merchant_orders IS 'View of orders for merchants and admins, with fallback to snapshots if original records are deleted';

COMMIT; 