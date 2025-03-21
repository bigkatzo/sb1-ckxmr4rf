-- Create function to get order analytics
CREATE OR REPLACE FUNCTION get_order_analytics(
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  WITH daily_sales AS (
    SELECT
      date_trunc('day', created_at) AS date,
      COUNT(*) AS orders,
      SUM(amount_sol) AS amount
    FROM merchant_orders
    WHERE created_at BETWEEN p_start_date AND p_end_date
      AND (
        -- Check permissions
        is_admin() OR
        collection_owner_id = auth.uid() OR
        access_type IS NOT NULL
      )
    GROUP BY date_trunc('day', created_at)
  ),
  product_stats AS (
    SELECT
      product_name,
      collection_name,
      COUNT(*) AS quantity,
      SUM(amount_sol) AS sol_amount
    FROM merchant_orders
    WHERE created_at BETWEEN p_start_date AND p_end_date
      AND (
        -- Check permissions
        is_admin() OR
        collection_owner_id = auth.uid() OR
        access_type IS NOT NULL
      )
    GROUP BY product_name, collection_name
    ORDER BY COUNT(*) DESC
  ),
  total_stats AS (
    SELECT
      COUNT(*) AS total_orders,
      SUM(amount_sol) AS total_sales
    FROM merchant_orders
    WHERE created_at BETWEEN p_start_date AND p_end_date
      AND (
        -- Check permissions
        is_admin() OR
        collection_owner_id = auth.uid() OR
        access_type IS NOT NULL
      )
  )
  SELECT json_build_object(
    'dailySales', (
      SELECT json_agg(
        json_build_object(
          'date', to_char(date, 'Mon DD'),
          'amount', amount,
          'orders', orders
        )
      )
      FROM daily_sales
    ),
    'productDistribution', (
      SELECT json_agg(
        json_build_object(
          'name', product_name,
          'value', quantity,
          'solAmount', sol_amount,
          'collection', collection_name
        )
      )
      FROM (
        SELECT *
        FROM product_stats
        LIMIT 5
      ) top_products
    ),
    'productsByQuantity', (
      SELECT json_agg(
        json_build_object(
          'name', CASE 
            WHEN length(product_name) > 20 
            THEN substring(product_name, 1, 20) || '...'
            ELSE product_name
          END,
          'quantity', quantity
        )
      )
      FROM (
        SELECT *
        FROM product_stats
        LIMIT 5
      ) top_products
    ),
    'productsBySol', (
      SELECT json_agg(
        json_build_object(
          'name', CASE 
            WHEN length(product_name) > 20 
            THEN substring(product_name, 1, 20) || '...'
            ELSE product_name
          END,
          'solAmount', sol_amount
        )
      )
      FROM (
        SELECT *
        FROM product_stats
        ORDER BY sol_amount DESC
        LIMIT 5
      ) top_products
    ),
    'allProducts', (
      SELECT json_agg(
        json_build_object(
          'name', product_name,
          'quantity', quantity,
          'solAmount', sol_amount,
          'collection', collection_name,
          'rank', row_number() OVER (ORDER BY quantity DESC)
        )
      )
      FROM (
        SELECT *
        FROM product_stats
        LIMIT 10
      ) all_products
    ),
    'totalSales', (SELECT total_sales FROM total_stats),
    'totalOrders', (SELECT total_orders FROM total_stats)
  ) INTO v_result;

  RETURN v_result;
END;
$$; 