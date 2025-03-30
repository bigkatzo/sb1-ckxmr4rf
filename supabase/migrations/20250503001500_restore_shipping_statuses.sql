-- Start transaction
BEGIN;

-- Set search path to ensure we're in the public schema
SET search_path TO public;

-- Store view definitions for recreation
DO $$
DECLARE
    merchant_view_def text;
    user_view_def text;
BEGIN
    -- Capture view definitions before dropping them
    SELECT pg_get_viewdef('merchant_orders'::regclass, true) INTO merchant_view_def;
    SELECT pg_get_viewdef('user_orders'::regclass, true) INTO user_view_def;
    
    -- Store them in temporary tables for later use
    CREATE TEMP TABLE view_definitions (
        view_name text,
        definition text
    );
    
    INSERT INTO view_definitions VALUES
        ('merchant_orders', merchant_view_def),
        ('user_orders', user_view_def);
END $$;

-- Create a backup of the current enum values
CREATE TABLE temp_order_statuses AS
SELECT DISTINCT status::text as status_value
FROM orders;

-- Create a temporary table to store orders data
CREATE TEMP TABLE temp_orders AS SELECT * FROM orders;

-- Drop all dependencies first
DROP TRIGGER IF EXISTS validate_order_status_trigger ON orders;
DROP FUNCTION IF EXISTS validate_order_status_transition();
DROP VIEW IF EXISTS public_order_counts;
DROP VIEW IF EXISTS merchant_orders;
DROP VIEW IF EXISTS user_orders;

-- Alter the column to be text temporarily
ALTER TABLE orders ALTER COLUMN status TYPE text;

-- Drop and recreate the enum type with all values
DROP TYPE IF EXISTS order_status_enum CASCADE;
CREATE TYPE order_status_enum AS ENUM (
  'draft',
  'pending_payment',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled'
);

-- Convert the column back to the enum type
ALTER TABLE orders 
  ALTER COLUMN status TYPE order_status_enum 
  USING status::order_status_enum;

-- Recreate the views
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

-- Recreate the merchant_orders and user_orders views
DO $$
DECLARE
    view_rec record;
BEGIN
    FOR view_rec IN SELECT * FROM view_definitions LOOP
        EXECUTE 'CREATE OR REPLACE VIEW ' || view_rec.view_name || ' AS ' || view_rec.definition;
    END LOOP;
END $$;

-- Recreate the status transition validation function
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow any transition from NULL (new order)
  IF OLD.status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  IF (OLD.status = 'draft' AND NEW.status = 'pending_payment') OR
     (OLD.status = 'pending_payment' AND NEW.status = 'confirmed') OR
     (OLD.status = 'confirmed' AND NEW.status = 'shipped') OR
     (OLD.status = 'shipped' AND NEW.status = 'delivered') OR
     (OLD.status = 'pending_payment' AND NEW.status = 'cancelled') OR
     (OLD.status = 'draft' AND NEW.status = 'cancelled') OR
     (OLD.status = 'confirmed' AND NEW.status = 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid order status transition from % to %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status transitions
CREATE TRIGGER validate_order_status_trigger
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status_transition();

-- Drop temporary tables
DROP TABLE temp_order_statuses;
DROP TABLE IF EXISTS temp_orders;
DROP TABLE IF EXISTS view_definitions;

-- Commit transaction
COMMIT; 