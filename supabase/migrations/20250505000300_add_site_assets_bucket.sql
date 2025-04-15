-- Add site-assets bucket and fix storage policies
-- This migration ensures the site-assets bucket exists and has proper access policies

-- First, ensure the site-assets bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('site-assets', 'site-assets', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/json'])
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/json'];

-- Drop existing policies and recreate them to include site-assets
-- We'll use a simplified approach that doesn't rely on pg_policies catalog structure
DO $$ 
BEGIN
  -- Drop existing policies (ignore errors if they don't exist)
  BEGIN
    DROP POLICY IF EXISTS "storage_read_policy" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN
    DROP POLICY IF EXISTS "storage_insert_policy" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN
    DROP POLICY IF EXISTS "storage_update_policy" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN
    DROP POLICY IF EXISTS "storage_delete_policy" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN
    DROP POLICY IF EXISTS "public_read" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN
    DROP POLICY IF EXISTS "authenticated_write" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN
    DROP POLICY IF EXISTS "authenticated_update" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN
    DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN
    DROP POLICY IF EXISTS "storage_read" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN
    DROP POLICY IF EXISTS "storage_write" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN
    DROP POLICY IF EXISTS "storage_modify" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN
    DROP POLICY IF EXISTS "storage_delete" ON storage.objects;
  EXCEPTION WHEN undefined_object THEN NULL; END;
    
  -- Create comprehensive policies that include site-assets
  CREATE POLICY "storage_read_policy"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id IN ('collection-images', 'product-images', 'site-assets'));

  CREATE POLICY "storage_insert_policy"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id IN ('collection-images', 'product-images', 'site-assets'));

  CREATE POLICY "storage_update_policy"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id IN ('collection-images', 'product-images', 'site-assets'));

  CREATE POLICY "storage_delete_policy"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id IN ('collection-images', 'product-images', 'site-assets'));
END $$;

-- Explicitly grant permissions to the service role
GRANT ALL PRIVILEGES ON SCHEMA storage TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA storage TO service_role;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA storage TO service_role; 