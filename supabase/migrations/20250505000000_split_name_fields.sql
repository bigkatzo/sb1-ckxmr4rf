-- Start transaction
BEGIN;

-- Update the contact_info validation function to support firstName and lastName fields
CREATE OR REPLACE FUNCTION validate_contact_info(info jsonb)
RETURNS boolean AS $$
BEGIN
    RETURN (
        jsonb_typeof(info) = 'object' AND
        info ? 'method' AND
        info ? 'value' AND
        (
            (info ? 'fullName') OR
            (info ? 'firstName' AND info ? 'lastName')
        ) AND
        jsonb_typeof(info->'method') = 'string' AND
        jsonb_typeof(info->'value') = 'string' AND
        (
            (jsonb_typeof(info->'fullName') = 'string') OR
            (jsonb_typeof(info->'firstName') = 'string' AND jsonb_typeof(info->'lastName') = 'string')
        ) AND
        (info ? 'phoneNumber' AND jsonb_typeof(info->'phoneNumber') = 'string' OR true)
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Migration function to split fullName into firstName and lastName for existing records
CREATE OR REPLACE FUNCTION migrate_fullname_to_first_last()
RETURNS text AS $$
DECLARE
    r RECORD;
    full_name text;
    first_name text;
    last_name text;
    space_pos integer;
    updated_count integer := 0;
BEGIN
    -- Loop through all orders with fullName but without firstName
    FOR r IN SELECT id, contact_info FROM orders WHERE contact_info ? 'fullName' AND NOT contact_info ? 'firstName'
    LOOP
        -- Get the full name
        full_name := r.contact_info->>'fullName';
        
        -- Find the position of the first space
        space_pos := position(' ' in full_name);
        
        -- If there's no space, use the full name as the first name
        IF space_pos = 0 THEN
            first_name := full_name;
            last_name := '';
        ELSE
            -- Split the name at the first space
            first_name := substring(full_name from 1 for space_pos - 1);
            last_name := substring(full_name from space_pos + 1);
        END IF;
        
        -- Update the record with the split name
        UPDATE orders
        SET contact_info = jsonb_set(
            jsonb_set(
                contact_info,
                '{firstName}',
                to_jsonb(first_name)
            ),
            '{lastName}',
            to_jsonb(last_name)
        )
        WHERE id = r.id;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count || ' records updated';
END;
$$ LANGUAGE plpgsql;

-- Call the migration function and log the result
DO $$
DECLARE
    result text;
BEGIN
    SELECT migrate_fullname_to_first_last() INTO result;
    RAISE NOTICE 'Migration completed: %', result;
END $$;

-- Drop the migration function when done
DROP FUNCTION migrate_fullname_to_first_last();

COMMIT; 