-- Convert existing eligibility rules to new format
UPDATE categories
SET eligibility_rules = jsonb_build_object(
  'groups',
  ARRAY[
    jsonb_build_object(
      'operator',
      'AND',
      'rules',
      COALESCE((eligibility_rules->>'rules')::jsonb, '[]'::jsonb)
    )
  ]
)
WHERE eligibility_rules IS NOT NULL
  AND eligibility_rules->>'rules' IS NOT NULL;

-- Set default for new records
ALTER TABLE categories
ALTER COLUMN eligibility_rules 
SET DEFAULT '{"groups": []}'::jsonb; 