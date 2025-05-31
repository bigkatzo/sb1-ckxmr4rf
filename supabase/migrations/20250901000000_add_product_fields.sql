-- Add new columns to the products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS pin_order SMALLINT,
ADD COLUMN IF NOT EXISTS blank_code TEXT,
ADD COLUMN IF NOT EXISTS technique TEXT,
ADD COLUMN IF NOT EXISTS note_for_supplier TEXT;

-- Add description to the pin_order column
COMMENT ON COLUMN products.pin_order IS 'Position for pinned products (1, 2, 3) or null if not pinned';

-- Add description to the blank_code column
COMMENT ON COLUMN products.blank_code IS 'Code for the blank product used in manufacturing';

-- Add description to the technique column
COMMENT ON COLUMN products.technique IS 'Manufacturing technique used for the product';

-- Add description to the note_for_supplier column
COMMENT ON COLUMN products.note_for_supplier IS 'Special notes for the supplier about this product';

-- Add constraint if it doesn't exist
DO $$
BEGIN
    -- Check if constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'pin_order_values' 
        AND conrelid = 'products'::regclass
    ) THEN
        -- Pin order constraint (can only be 1, 2, 3, or null)
        ALTER TABLE products 
        ADD CONSTRAINT pin_order_values
        CHECK (pin_order IS NULL OR pin_order BETWEEN 1 AND 3);
    END IF;
END
$$;

-- Safely update views to include new fields

-- Create a function to safely recreate the merchant_products view
CREATE OR REPLACE FUNCTION recreate_merchant_products_view() RETURNS void AS $$
DECLARE
    view_exists boolean;
    column_exists boolean;
BEGIN
    -- Check if the view exists
    SELECT EXISTS (
        SELECT FROM pg_views WHERE viewname = 'merchant_products'
    ) INTO view_exists;
    
    -- Check if any of our new columns already exist in the view
    IF view_exists THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'merchant_products' AND column_name = 'pin_order'
        ) INTO column_exists;
        
        -- Only recreate if the column doesn't exist
        IF NOT column_exists THEN
            -- Create a temporary view definition to store the existing view's definition
            CREATE TEMP TABLE temp_view_def AS
            SELECT pg_get_viewdef('merchant_products'::regclass) AS definition;
            
            -- Drop the existing view
            DROP VIEW merchant_products;
            
            -- Create a new view that includes the new columns
            EXECUTE 'CREATE VIEW merchant_products AS
            SELECT 
                p.id,
                p.name,
                p.sku,
                p.description,
                p.price,
                p.images,
                p.design_files,
                p.quantity,
                p.minimum_order_quantity,
                p.category_id,
                p.variants,
                p.variant_prices,
                p.slug,
                p.price_modifier_before_min,
                p.price_modifier_after_min,
                p.visible,
                p.sale_ended,
                p.notes,
                p.free_notes,
                p.pin_order,
                p.blank_code,
                p.technique,
                p.note_for_supplier,
                c.id as collection_id,
                c.name as collection_name,
                c.slug as collection_slug,
                c.launch_date as collection_launch_date,
                c.sale_ended as collection_sale_ended,
                c.visible as collection_visible,
                cat.name as category_name,
                cat.description as category_description,
                cat.type as category_type,
                cat.eligibility_rules as category_eligibility_rules,
                cat.sale_ended as category_sale_ended,
                cat.visible as category_visible
            FROM products p
            JOIN collections c ON c.id = p.collection_id
            LEFT JOIN categories cat ON cat.id = p.category_id';
            
            -- Drop temporary table
            DROP TABLE temp_view_def;
        END IF;
    ELSE
        -- If the view doesn't exist, create it
        EXECUTE 'CREATE VIEW merchant_products AS
        SELECT 
            p.id,
            p.name,
            p.sku,
            p.description,
            p.price,
            p.images,
            p.design_files,
            p.quantity,
            p.minimum_order_quantity,
            p.category_id,
            p.variants,
            p.variant_prices,
            p.slug,
            p.price_modifier_before_min,
            p.price_modifier_after_min,
            p.visible,
            p.sale_ended,
            p.notes,
            p.free_notes,
            p.pin_order,
            p.blank_code,
            p.technique,
            p.note_for_supplier,
            c.id as collection_id,
            c.name as collection_name,
            c.slug as collection_slug,
            c.launch_date as collection_launch_date,
            c.sale_ended as collection_sale_ended,
            c.visible as collection_visible,
            cat.name as category_name,
            cat.description as category_description,
            cat.type as category_type,
            cat.eligibility_rules as category_eligibility_rules,
            cat.sale_ended as category_sale_ended,
            cat.visible as category_visible
        FROM products p
        JOIN collections c ON c.id = p.collection_id
        LEFT JOIN categories cat ON cat.id = p.category_id';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to safely recreate the public_products view
CREATE OR REPLACE FUNCTION recreate_public_products_view() RETURNS void AS $$
DECLARE
    view_exists boolean;
    column_exists boolean;
    dependent_schema text;
    dependent_view text;
    view_definition text;
    rec record;
BEGIN
    -- Check if the view exists
    SELECT EXISTS (
        SELECT FROM pg_views WHERE viewname = 'public_products'
    ) INTO view_exists;
    
    -- Check if any of our new columns already exist in the view
    IF view_exists THEN
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'public_products' AND column_name = 'pin_order'
        ) INTO column_exists;
        
        -- Only recreate if the column doesn't exist
        IF NOT column_exists THEN
            -- Get dependent views
            CREATE TEMP TABLE dependent_views AS
            SELECT dependent_ns.nspname as dependent_schema,
                   dependent_view.relname as dependent_view,
                   pg_get_viewdef(dependent_view.oid) as view_definition
            FROM pg_depend 
            JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid 
            JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid 
            JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid 
            JOIN pg_namespace dependent_ns ON dependent_view.relnamespace = dependent_ns.oid
            JOIN pg_namespace source_ns ON source_table.relnamespace = source_ns.oid
            WHERE source_table.relname = 'public_products'
            AND dependent_view.relname != 'public_products'
            AND source_ns.nspname = 'public'
            AND pg_depend.classid = 'pg_rewrite'::regclass
            AND dependent_view.relkind = 'v';
            
            -- Drop dependent views
            FOR rec IN SELECT * FROM dependent_views LOOP
                EXECUTE 'DROP VIEW IF EXISTS ' || rec.dependent_schema || '.' || rec.dependent_view || ' CASCADE';
            END LOOP;
            
            -- Drop the existing view
            DROP VIEW public_products;
            
            -- Create a new view that includes the new columns
            EXECUTE 'CREATE VIEW public_products AS
            SELECT 
                p.id,
                p.name,
                p.sku,
                p.description,
                p.price,
                p.images,
                p.design_files,
                p.quantity,
                p.minimum_order_quantity,
                p.category_id,
                p.variants,
                p.variant_prices,
                p.slug,
                p.price_modifier_before_min,
                p.price_modifier_after_min,
                p.visible,
                p.sale_ended,
                p.notes,
                p.free_notes,
                p.pin_order,
                p.blank_code,
                p.technique,
                p.note_for_supplier,
                c.id as collection_id,
                c.name as collection_name,
                c.slug as collection_slug,
                c.launch_date as collection_launch_date,
                c.sale_ended as collection_sale_ended,
                c.visible as collection_visible,
                cat.name as category_name,
                cat.description as category_description,
                cat.type as category_type,
                cat.eligibility_rules as category_eligibility_rules,
                cat.sale_ended as category_sale_ended,
                cat.visible as category_visible
            FROM products p
            JOIN collections c ON c.id = p.collection_id
            LEFT JOIN categories cat ON cat.id = p.category_id
            WHERE p.visible = true AND c.visible = true';
            
            -- Recreate dependent views
            FOR rec IN SELECT * FROM dependent_views LOOP
                EXECUTE rec.view_definition;
            END LOOP;
            
            -- Drop temporary table
            DROP TABLE dependent_views;
        END IF;
    ELSE
        -- If the view doesn't exist, create it
        EXECUTE 'CREATE VIEW public_products AS
        SELECT 
            p.id,
            p.name,
            p.sku,
            p.description,
            p.price,
            p.images,
            p.design_files,
            p.quantity,
            p.minimum_order_quantity,
            p.category_id,
            p.variants,
            p.variant_prices,
            p.slug,
            p.price_modifier_before_min,
            p.price_modifier_after_min,
            p.visible,
            p.sale_ended,
            p.notes,
            p.free_notes,
            p.pin_order,
            p.blank_code,
            p.technique,
            p.note_for_supplier,
            c.id as collection_id,
            c.name as collection_name,
            c.slug as collection_slug,
            c.launch_date as collection_launch_date,
            c.sale_ended as collection_sale_ended,
            c.visible as collection_visible,
            cat.name as category_name,
            cat.description as category_description,
            cat.type as category_type,
            cat.eligibility_rules as category_eligibility_rules,
            cat.sale_ended as category_sale_ended,
            cat.visible as category_visible
        FROM products p
        JOIN collections c ON c.id = p.collection_id
        LEFT JOIN categories cat ON cat.id = p.category_id
        WHERE p.visible = true AND c.visible = true';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Call the functions to recreate the views
SELECT recreate_merchant_products_view();
SELECT recreate_public_products_view();

-- Clean up by dropping the temporary functions
DROP FUNCTION recreate_merchant_products_view();
DROP FUNCTION recreate_public_products_view(); 