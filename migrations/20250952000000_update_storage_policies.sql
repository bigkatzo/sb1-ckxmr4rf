-- Update storage policies to include product-design-files bucket
DO $$ 
DECLARE
  policies RECORD;
  policy_query TEXT;
BEGIN
  -- Find all existing RLS policies on storage.objects
  FOR policies IN 
    SELECT 
      polname AS policy_name,
      pg_get_expr(polqual, polrelid) AS policy_definition
    FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
  LOOP
    -- Check if policy has bucket_id IN list of buckets but not product-design-files
    IF policies.policy_definition LIKE '%bucket_id IN%' AND 
       policies.policy_definition NOT LIKE '%''product-design-files''%' THEN
      
      RAISE NOTICE 'Updating policy: %', policies.policy_name;
      
      -- Get the policy's purpose (SELECT, INSERT, etc.)
      SELECT
        CASE 
          WHEN policies.policy_name LIKE '%select%' OR policies.policy_name LIKE '%read%' THEN 'SELECT'
          WHEN policies.policy_name LIKE '%insert%' OR policies.policy_name LIKE '%write%' THEN 'INSERT'
          WHEN policies.policy_name LIKE '%update%' OR policies.policy_name LIKE '%modify%' THEN 'UPDATE'
          WHEN policies.policy_name LIKE '%delete%' THEN 'DELETE'
          ELSE 'ALL'
        END INTO policy_query;
      
      -- Drop and recreate the policy with product-design-files included
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policies.policy_name);
      
      -- Create the new policy with product-design-files added
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects FOR %s TO %s USING (bucket_id IN (''collection-images'', ''product-images'', ''site-assets'', ''profile-images'', ''product-design-files''))',
        policies.policy_name,
        policy_query,
        CASE
          WHEN policies.policy_name LIKE '%public%' OR policies.policy_name LIKE '%read%' THEN 'public'
          ELSE 'authenticated'
        END
      );
      
      -- Add WITH CHECK clause for INSERT policies
      IF policy_query = 'INSERT' THEN
        EXECUTE format(
          'ALTER POLICY %I ON storage.objects WITH CHECK (bucket_id IN (''collection-images'', ''product-images'', ''site-assets'', ''profile-images'', ''product-design-files''))',
          policies.policy_name
        );
      END IF;
    END IF;
  END LOOP;
END $$; 