-- Add product-design-files bucket to storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('product-design-files', 'product-design-files', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/json'])
ON CONFLICT (id) DO UPDATE 
SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Update all relevant storage policies to include the new bucket
DO $$ 
DECLARE
  policy_name text;
  policy_def text;
BEGIN
  -- Find all existing policies that reference product-images or collection-images
  FOR policy_name, policy_def IN 
    SELECT 
      p.polname, 
      pg_get_expr(p.polqual, p.polrelid) AS policy_def
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
      AND pg_get_expr(p.polqual, p.polrelid) LIKE '%bucket_id IN%'
  LOOP
    -- If the policy includes collection-images or product-images but not product-design-files
    IF policy_def LIKE '%bucket_id IN%' AND 
       (policy_def LIKE '%''collection-images''%' OR policy_def LIKE '%''product-images''%') AND
       policy_def NOT LIKE '%''product-design-files''%' THEN
      
      -- Create new policy definition with product-design-files added
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON storage.objects',
        policy_name
      );
      
      EXECUTE format(
        'CREATE POLICY %I ON storage.objects 
         FOR %s 
         TO %s 
         %s 
         USING (bucket_id IN (''collection-images'', ''product-images'', ''product-design-files''))',
        policy_name,
        CASE 
          WHEN policy_name LIKE '%select%' OR policy_name LIKE '%read%' THEN 'SELECT'
          WHEN policy_name LIKE '%insert%' OR policy_name LIKE '%write%' THEN 'INSERT'
          WHEN policy_name LIKE '%update%' OR policy_name LIKE '%modify%' THEN 'UPDATE'
          WHEN policy_name LIKE '%delete%' THEN 'DELETE'
          ELSE 'ALL'
        END,
        CASE
          WHEN policy_name LIKE '%public%' OR policy_name LIKE '%read%' THEN 'public'
          ELSE 'authenticated'
        END,
        CASE
          WHEN policy_name LIKE '%insert%' OR policy_name LIKE '%write%' THEN 'WITH CHECK'
          ELSE ''
        END
      );
    END IF;
  END LOOP;
END $$; 