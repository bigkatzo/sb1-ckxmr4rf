-- Start transaction
BEGIN;

-- Drop the old trigger and function
DROP TRIGGER IF EXISTS ensure_tracking_number_only_update ON orders;
DROP FUNCTION IF EXISTS check_tracking_number_only_update();

-- Create new function that allows status updates
CREATE OR REPLACE FUNCTION check_tracking_number_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow status updates
    IF NEW.status != OLD.status THEN
        RETURN NEW;
    END IF;

    -- Allow transaction signature updates
    IF NEW.transaction_signature != OLD.transaction_signature THEN
        RETURN NEW;
    END IF;

    -- For all other updates, only allow tracking_number changes
    IF (
        NEW.order_number = OLD.order_number AND
        NEW.collection_id = OLD.collection_id AND
        NEW.product_id = OLD.product_id AND
        NEW.wallet_address = OLD.wallet_address AND
        NEW.shipping_address = OLD.shipping_address AND
        NEW.contact_info = OLD.contact_info AND
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

-- Create new trigger
CREATE TRIGGER check_tracking_number_update
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION check_tracking_number_update();

COMMIT; 