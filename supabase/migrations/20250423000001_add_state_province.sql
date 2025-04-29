-- Start transaction
BEGIN;

-- Update validation function to accept state field
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
        jsonb_typeof(addr->'zip') = 'string' AND
        (NOT (addr ? 'state') OR jsonb_typeof(addr->'state') = 'string')
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMIT; 