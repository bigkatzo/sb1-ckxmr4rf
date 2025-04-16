-- Fix storage policies to ensure all buckets work correctly
-- This migration adds missing columns and fixes policies

-- First, check and add the missing columns if they don't exist
DO $$ 
BEGIN
    -- Check if owner column exists in objects table
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'storage' 
        AND table_name = 'objects' 
        AND column_name = 'owner'
    ) THEN
        -- Add the owner column
        ALTER TABLE storage.objects ADD COLUMN owner uuid;
    END IF;
    
    -- Check if owner_id column exists in objects table
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'storage' 
        AND table_name = 'objects' 
        AND column_name = 'owner_id'
    ) THEN
        -- Add the owner_id column
        ALTER TABLE storage.objects ADD COLUMN owner_id uuid;
    END IF;
    
    -- Check if user_metadata column exists in objects table
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'storage' 
        AND table_name = 'objects' 
        AND column_name = 'user_metadata'
    ) THEN
        -- Add the user_metadata column
        ALTER TABLE storage.objects ADD COLUMN user_metadata jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Ensure all buckets exist and are configured correctly
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('collection-images', 'collection-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']),
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']),
  ('site-assets', 'site-assets', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/json'])
ON CONFLICT (id) DO UPDATE 
SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop all existing policies to avoid conflicts
DO $$ 
BEGIN
  -- Drop any policies that might exist (ignore errors)
  BEGIN DROP POLICY IF EXISTS "storage_read_policy" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "storage_insert_policy" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "storage_update_policy" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "storage_delete_policy" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN DROP POLICY IF EXISTS "public_read" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "authenticated_write" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "authenticated_update" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN DROP POLICY IF EXISTS "Storage read" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Storage write" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Storage modify" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "Storage delete" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN DROP POLICY IF EXISTS "storage_read" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "storage_write" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "storage_modify" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "storage_delete" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  
  BEGIN DROP POLICY IF EXISTS "storage_objects_select_policy" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "storage_objects_insert_policy" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "storage_objects_update_policy" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
  BEGIN DROP POLICY IF EXISTS "storage_objects_delete_policy" ON storage.objects; EXCEPTION WHEN undefined_object THEN NULL; END;
END $$;

-- Create comprehensive storage policies that allow access to all buckets
-- Read policy (public access)
CREATE POLICY "storage_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images', 'site-assets'));

-- Write policy (authenticated users only)
CREATE POLICY "storage_write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images', 'site-assets'));

-- Update policy (authenticated users only)
CREATE POLICY "storage_modify"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images', 'site-assets'));

-- Delete policy (authenticated users only)
CREATE POLICY "storage_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images', 'site-assets'));

-- Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Grant all permissions to service role for proper functioning
GRANT ALL PRIVILEGES ON SCHEMA storage TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA storage TO service_role;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA storage TO service_role; 