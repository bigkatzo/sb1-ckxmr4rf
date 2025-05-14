-- Create a simple view for order data bypassing RLS
BEGIN;

-- Function to check if a view exists
CREATE OR REPLACE FUNCTION view_exists(view_name TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT FROM pg_views
    WHERE schemaname = 'public' AND viewname = view_name
  );
END;
$$ LANGUAGE plpgsql;

-- Create a view to bypass RLS for orders table
DO $$
BEGIN
  IF NOT view_exists('rls_bypassed_orders') THEN
    EXECUTE 'CREATE VIEW rls_bypassed_orders AS SELECT * FROM orders';
  END IF;
END $$;

-- Drop the temporary function
DROP FUNCTION view_exists(TEXT);

COMMIT; 