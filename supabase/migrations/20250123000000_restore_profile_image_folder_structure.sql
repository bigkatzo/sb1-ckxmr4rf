-- Migration to restore proper profile image folder structure and policies
-- 
-- PROBLEM: Generic policies that include 'profile-images' in bucket lists are overriding
-- the specific user folder requirements for profile images.
--
-- SOLUTION: Completely separate profile-images from other buckets in policies.
-- - profile-images gets its own specific policies with user folder enforcement
-- - All other buckets get separate generic policies (without profile-images)
-- - This prevents policy conflicts and ensures proper isolation

BEGIN;

-- Step 1: Drop ALL existing storage policies to start clean
-- This prevents any policy conflicts or overrides
DO $$ 
DECLARE
  pol record;
BEGIN
  -- Drop ALL existing policies on storage.objects
  FOR pol IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
  ) LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
      RAISE NOTICE 'Dropped existing policy: %', pol.policyname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to drop policy %: %', pol.policyname, SQLERRM;
    END;
  END LOOP;
END $$;

-- Step 2: Ensure the profile-images bucket exists with correct configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-images', 'profile-images', true, 10485760, NULL)
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = NULL; -- Allow any image type

-- Step 3: Create ISOLATED policies for profile-images bucket ONLY
-- These policies enforce the user folder structure: {userId}/{filename}

-- Profile images: Public read access (no folder restriction for reading)
CREATE POLICY "profile_images_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-images');

-- Profile images: Users can only upload to their own folder
CREATE POLICY "profile_images_user_upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Profile images: Users can only update files in their own folder
CREATE POLICY "profile_images_user_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Profile images: Users can only delete files in their own folder
CREATE POLICY "profile_images_user_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Step 4: Create SEPARATE generic policies for ALL OTHER buckets
-- CRITICAL: profile-images is explicitly EXCLUDED from these policies
-- This prevents any policy conflicts or overrides

-- Other buckets: Public read access (NO profile-images)
CREATE POLICY "general_buckets_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id IN ('collection-images', 'product-images', 'site-assets', 'product-design-files', 'collection-logos')
    AND bucket_id != 'profile-images'  -- Explicit exclusion for safety
  );

-- Other buckets: Authenticated upload access (NO profile-images)
CREATE POLICY "general_buckets_auth_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('collection-images', 'product-images', 'site-assets', 'product-design-files', 'collection-logos')
    AND bucket_id != 'profile-images'  -- Explicit exclusion for safety
  );

-- Other buckets: Authenticated update access (NO profile-images)
CREATE POLICY "general_buckets_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('collection-images', 'product-images', 'site-assets', 'product-design-files', 'collection-logos')
    AND bucket_id != 'profile-images'  -- Explicit exclusion for safety
  );

-- Other buckets: Authenticated delete access (NO profile-images)
CREATE POLICY "general_buckets_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('collection-images', 'product-images', 'site-assets', 'product-design-files', 'collection-logos')
    AND bucket_id != 'profile-images'  -- Explicit exclusion for safety
  );

-- Step 5: Ensure RLS is enabled and grant permissions
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated, anon;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

-- Step 6: Log the policy setup for verification
DO $$
BEGIN
  RAISE NOTICE '=== PROFILE IMAGE POLICY SETUP COMPLETE ===';
  RAISE NOTICE 'Profile images: Require user folder structure (userId/filename)';
  RAISE NOTICE 'Other buckets: Standard access without folder restrictions';
  RAISE NOTICE 'Policies are completely isolated to prevent conflicts';
END $$;

COMMIT; 