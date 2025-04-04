-- First, ensure order_id has a unique constraint
ALTER TABLE order_tracking DROP CONSTRAINT IF EXISTS order_tracking_order_id_key;
ALTER TABLE order_tracking ADD CONSTRAINT order_tracking_order_id_key UNIQUE (order_id);

-- Create a function to update tracking that handles the unique constraint
CREATE OR REPLACE FUNCTION update_order_tracking(
    p_order_id uuid,
    p_tracking_number text,
    p_carrier text DEFAULT NULL,
    p_status text DEFAULT NULL,
    p_status_details text DEFAULT NULL,
    p_estimated_delivery_date timestamptz DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    v_tracking_id uuid;
BEGIN
    INSERT INTO order_tracking (
        order_id,
        tracking_number,
        carrier,
        status,
        status_details,
        estimated_delivery_date
    ) VALUES (
        p_order_id,
        p_tracking_number,
        p_carrier,
        p_status,
        p_status_details,
        p_estimated_delivery_date
    )
    ON CONFLICT (order_id) DO UPDATE SET
        tracking_number = EXCLUDED.tracking_number,
        carrier = EXCLUDED.carrier,
        status = EXCLUDED.status,
        status_details = EXCLUDED.status_details,
        estimated_delivery_date = EXCLUDED.estimated_delivery_date,
        last_update = NOW()
    RETURNING id INTO v_tracking_id;

    RETURN v_tracking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_order_tracking TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION update_order_tracking IS 'Updates or creates tracking information for an order, ensuring only one tracking number exists per order.';

-- Clean up any duplicate tracking numbers (keep the latest one)
WITH latest_tracking AS (
    SELECT DISTINCT ON (order_id) 
        id,
        order_id
    FROM order_tracking
    ORDER BY order_id, created_at DESC
)
DELETE FROM order_tracking ot
WHERE NOT EXISTS (
    SELECT 1 
    FROM latest_tracking lt 
    WHERE lt.id = ot.id
); 