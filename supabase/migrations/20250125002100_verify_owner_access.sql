-- First, let's identify any collections missing owner access entries
DO $$ 
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*)
  INTO missing_count
  FROM collections c
  WHERE NOT EXISTS (
    SELECT 1 
    FROM collection_access ca 
    WHERE ca.collection_id = c.id 
    AND ca.user_id = c.user_id
    AND ca.access_type = 'edit'
  );

  -- If any are missing, insert them
  IF missing_count > 0 THEN
    INSERT INTO collection_access (collection_id, user_id, access_type)
    SELECT 
      c.id as collection_id,
      c.user_id,
      'edit'::access_type as access_type
    FROM collections c
    WHERE NOT EXISTS (
      SELECT 1 
      FROM collection_access ca 
      WHERE ca.collection_id = c.id 
      AND ca.user_id = c.user_id
    );

    RAISE NOTICE 'Added % missing owner access entries', missing_count;
  END IF;

  -- Update any existing entries that aren't 'edit'
  UPDATE collection_access ca
  SET access_type = 'edit'
  FROM collections c
  WHERE ca.collection_id = c.id
  AND ca.user_id = c.user_id
  AND ca.access_type != 'edit';
END $$; 