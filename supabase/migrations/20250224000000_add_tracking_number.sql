-- Start transaction
BEGIN;

-- Add tracking_number column to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS tracking_number text;

-- Add index for tracking number lookups
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number);

-- Add RLS policy for updating tracking numbers
CREATE POLICY "orders_update_tracking"
ON orders
FOR UPDATE
USING (
    -- Collection owners can update tracking
    EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = collection_id
        AND c.user_id = auth.uid()
    )
    OR
    -- Users with edit access can update tracking
    EXISTS (
        SELECT 1 FROM collection_access ca
        WHERE ca.collection_id = collection_id
        AND ca.user_id = auth.uid()
        AND ca.access_type = 'edit'
    )
    OR
    -- Admins can update all orders
    EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
)
WITH CHECK (
    -- Only allow updating the tracking_number column
    (
        collection_id IN (
            -- Collection owners can update tracking
            SELECT c.id FROM collections c
            WHERE c.user_id = auth.uid()
            UNION
            -- Users with edit access can update tracking
            SELECT ca.collection_id FROM collection_access ca
            WHERE ca.user_id = auth.uid()
            AND ca.access_type = 'edit'
            UNION
            -- Admins can update all collections
            SELECT c.id FROM collections c
            WHERE EXISTS (
                SELECT 1 FROM user_profiles up
                WHERE up.id = auth.uid()
                AND up.role = 'admin'
            )
        )
    )
);

COMMENT ON COLUMN orders.tracking_number IS 'Shipping tracking number for the order';

-- Add trigger to ensure only tracking_number can be modified
CREATE OR REPLACE FUNCTION check_tracking_number_only_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (
        NEW.order_number = OLD.order_number AND
        NEW.collection_id = OLD.collection_id AND
        NEW.product_id = OLD.product_id AND
        NEW.wallet_address = OLD.wallet_address AND
        NEW.transaction_signature = OLD.transaction_signature AND
        NEW.shipping_address = OLD.shipping_address AND
        NEW.contact_info = OLD.contact_info AND
        NEW.status = OLD.status AND
        NEW.amount_sol = OLD.amount_sol AND
        NEW.created_at = OLD.created_at AND
        NEW.variant_selections = OLD.variant_selections
    ) THEN
        RETURN NEW;
    ELSE
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_tracking_number_only_update
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION check_tracking_number_only_update();

COMMIT; 