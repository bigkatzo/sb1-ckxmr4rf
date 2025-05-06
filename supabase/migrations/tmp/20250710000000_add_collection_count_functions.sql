-- Create functions to count products and categories by collection

-- Function to get product counts by collection
-- Drop function if it exists with any parameters to avoid conflicts
DROP FUNCTION IF EXISTS get_product_counts_by_collection(uuid[]);

CREATE FUNCTION get_product_counts_by_collection(collection_ids uuid[])
RETURNS TABLE (collection_id uuid, count bigint) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.collection_id,
    COUNT(*) as count
  FROM products p
  WHERE p.collection_id = ANY(collection_ids)
  GROUP BY p.collection_id;
$$;

-- Function to get category counts by collection
-- Drop function if it exists with any parameters to avoid conflicts
DROP FUNCTION IF EXISTS get_category_counts_by_collection(uuid[]);

CREATE FUNCTION get_category_counts_by_collection(collection_ids uuid[])
RETURNS TABLE (collection_id uuid, count bigint) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    c.collection_id,
    COUNT(*) as count
  FROM categories c
  WHERE c.collection_id = ANY(collection_ids)
  GROUP BY c.collection_id;
$$;

-- Function to get product counts by category
-- Drop function if it exists with any parameters to avoid conflicts
DROP FUNCTION IF EXISTS get_product_counts_by_category(uuid[]);

CREATE FUNCTION get_product_counts_by_category(category_ids uuid[])
RETURNS TABLE (category_id uuid, count bigint) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    cp.category_id,
    COUNT(DISTINCT cp.product_id) as count
  FROM category_products cp
  WHERE cp.category_id = ANY(category_ids)
  GROUP BY cp.category_id;
$$;

-- Grant access to these functions (do this conditionally to avoid errors if already granted)
DO $$
BEGIN
  -- Grant permissions safely
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'get_product_counts_by_collection'
  ) THEN
    GRANT EXECUTE ON FUNCTION get_product_counts_by_collection TO authenticated;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'get_category_counts_by_collection'
  ) THEN
    GRANT EXECUTE ON FUNCTION get_category_counts_by_collection TO authenticated;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'get_product_counts_by_category'
  ) THEN
    GRANT EXECUTE ON FUNCTION get_product_counts_by_category TO authenticated;
  END IF;
END
$$; 