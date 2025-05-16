-- Migration to disable ALL unnecessary filename sanitization functions and triggers
-- Date: 2025-05-17
-- 
-- This migration removes all database-side filename sanitization since we now handle
-- file naming properly in the frontend code with generateSafeFilename()

BEGIN;

-- 1. Disable all storage-related filename sanitization triggers
DROP TRIGGER IF EXISTS sanitize_filename_trigger ON storage.objects;
DROP TRIGGER IF EXISTS storage_filename_sanitize_trigger ON storage.objects;

-- 2. Disable collection and product sanitization triggers (already handled in previous migration)
-- Just to be safe, drop them again
DROP TRIGGER IF EXISTS sanitize_collection_images_trigger ON collections;
DROP TRIGGER IF EXISTS sanitize_product_images_trigger ON products;

-- 3. Drop sanitization functions
DO $$ BEGIN
  -- Filename sanitization functions
  DROP FUNCTION IF EXISTS storage.sanitize_filename(text) CASCADE;
  DROP FUNCTION IF EXISTS storage.sanitize_filename_trigger() CASCADE;
  DROP FUNCTION IF EXISTS public.sanitize_filename(text) CASCADE;
  DROP FUNCTION IF EXISTS public.sanitizeFilename(text) CASCADE;
  
  -- URL sanitization functions (we only need validation, not modification)
  DROP FUNCTION IF EXISTS sanitize_image_url(text) CASCADE;
  DROP FUNCTION IF EXISTS storage.sanitize_image_url(text) CASCADE;
  DROP FUNCTION IF EXISTS public.sanitize_image_url(text) CASCADE;
  
  -- Old generation functions that might interfere
  DROP FUNCTION IF EXISTS storage_sanitize_filename_trigger() CASCADE;
  DROP FUNCTION IF EXISTS generate_storage_filename(text, text) CASCADE;
  DROP FUNCTION IF EXISTS storage.generate_storage_filename(text, text) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- 4. Create proper validation-only functions without modification

-- Create a simple validation function for image URLs
CREATE OR REPLACE FUNCTION public.validate_image_url(url text)
RETURNS boolean AS $$
BEGIN
  -- Basic URL validation
  IF url IS NULL OR url = '' THEN
    RETURN false;
  END IF;

  -- Check if it's a valid URL
  IF NOT (url ~* '^https?://') THEN
    RETURN false;
  END IF;

  -- Allow all URLs from our Supabase project
  IF url ~* '^https?://sakysysfksculqobozxi\.supabase\.co/storage/v1/object/public/' THEN
    RETURN true;
  END IF;

  -- Allow all URLs that look like images or storage
  IF url ~* '\.(jpg|jpeg|png|gif|webp|avif)([?#].*)?$' THEN
    RETURN true;
  END IF;

  -- Allow image-like paths
  IF url ~* '/(image|photo|media|storage|assets|uploads?)/' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a validation-only functions for URLs that doesn't modify them
CREATE OR REPLACE FUNCTION public.validate_storage_path(path text)
RETURNS boolean AS $$
BEGIN
  -- Basic path validation
  IF path IS NULL OR path = '' THEN
    RETURN false;
  END IF;

  -- Check for valid file extensions
  IF path ~* '\.(jpg|jpeg|png|gif|webp|svg|avif)$' THEN
    RETURN true;
  END IF;

  -- Allow paths with valid bucket prefixes
  IF path ~* '^(collection-images|product-images|site-assets|profile-images)/' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add permission for authenticated users
GRANT EXECUTE ON FUNCTION public.validate_image_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_storage_path(text) TO authenticated;

COMMIT; 