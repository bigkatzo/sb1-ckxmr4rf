-- Start transaction
BEGIN;

-- Create a temporary function to handle the data conversion
CREATE OR REPLACE FUNCTION convert_shipping_info()
RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    -- Loop through all orders
    FOR r IN SELECT id, shipping_address FROM orders
    LOOP
        -- Handle NULL or invalid shipping_address
        IF r.shipping_address IS NULL THEN
            -- Set default values for missing data
            UPDATE orders 
            SET 
                contact_info = jsonb_build_object(
                    'method', 'email',
                    'value', 'unknown'
                ),
                shipping_address = jsonb_build_object(
                    'address', 'unknown',
                    'city', 'unknown',
                    'country', 'unknown',
                    'zip', 'unknown'
                )
            WHERE id = r.id;
        ELSE
            -- Extract contact info from old shipping_address (previously shipping_info)
            -- Handle potentially missing contactMethod/contactValue
            UPDATE orders 
            SET 
                contact_info = jsonb_build_object(
                    'method', COALESCE(r.shipping_address->>'contactMethod', 'email'),
                    'value', COALESCE(r.shipping_address->>'contactValue', 'unknown')
                ),
                shipping_address = jsonb_build_object(
                    'address', COALESCE(r.shipping_address->>'address', 'unknown'),
                    'city', COALESCE(r.shipping_address->>'city', 'unknown'),
                    'country', COALESCE(r.shipping_address->>'country', 'unknown'),
                    'zip', COALESCE(r.shipping_address->>'zip', 'unknown')
                )
            WHERE id = r.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the conversion
SELECT convert_shipping_info();

-- Drop the temporary function
DROP FUNCTION convert_shipping_info();

-- Add validation check constraints
CREATE OR REPLACE FUNCTION validate_shipping_address(addr jsonb)
RETURNS boolean AS $$
BEGIN
    RETURN (
        jsonb_typeof(addr) = 'object' AND
        addr ? 'address' AND
        addr ? 'city' AND
        addr ? 'country' AND
        addr ? 'zip' AND
        jsonb_typeof(addr->'address') = 'string' AND
        jsonb_typeof(addr->'city') = 'string' AND
        jsonb_typeof(addr->'country') = 'string' AND
        jsonb_typeof(addr->'zip') = 'string'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION validate_contact_info(info jsonb)
RETURNS boolean AS $$
BEGIN
    RETURN (
        jsonb_typeof(info) = 'object' AND
        info ? 'method' AND
        info ? 'value' AND
        jsonb_typeof(info->'method') = 'string' AND
        jsonb_typeof(info->'value') = 'string'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- First ensure all rows have the required columns
UPDATE orders 
SET 
    shipping_address = jsonb_build_object(
        'address', 'unknown',
        'city', 'unknown',
        'country', 'unknown',
        'zip', 'unknown'
    )
WHERE shipping_address IS NULL;

UPDATE orders 
SET 
    contact_info = jsonb_build_object(
        'method', 'email',
        'value', 'unknown'
    )
WHERE contact_info IS NULL;

-- Now add NOT NULL constraints
ALTER TABLE orders 
    ALTER COLUMN shipping_address SET NOT NULL,
    ALTER COLUMN contact_info SET NOT NULL;

-- Finally add the check constraints
ALTER TABLE orders
    ADD CONSTRAINT valid_shipping_address
        CHECK (validate_shipping_address(shipping_address)),
    ADD CONSTRAINT valid_contact_info
        CHECK (validate_contact_info(contact_info));

COMMIT; 