-- Check for any collections without proper owner access
SELECT 
    c.id as collection_id,
    c.name as collection_name,
    c.user_id as owner_id,
    CASE 
        WHEN ca.access_type IS NULL THEN 'NO ACCESS'
        ELSE ca.access_type::text
    END as owner_access_type
FROM collections c
LEFT JOIN collection_access ca ON 
    c.id = ca.collection_id AND 
    c.user_id = ca.user_id
WHERE ca.access_type IS NULL OR ca.access_type != 'edit'; 