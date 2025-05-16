-- Migration to fix storage URL rendering issues

BEGIN;

-- Function to get direct object URL based on bucket and path
CREATE OR REPLACE FUNCTION public.get_storage_object_url(
  bucket_name TEXT,
  file_path TEXT
)
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
BEGIN
  -- Get base URL from current bucket
  SELECT replace(system_url, '/supabase', '') INTO base_url 
  FROM supabase_functions.config;
  
  -- Return properly formatted URL
  RETURN format('%s/storage/v1/object/public/%s/%s',
                base_url,
                bucket_name,
                file_path);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get render URL based on bucket and path
CREATE OR REPLACE FUNCTION public.get_storage_render_url(
  bucket_name TEXT,
  file_path TEXT,
  width INTEGER DEFAULT NULL,
  height INTEGER DEFAULT NULL,
  format TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  base_url TEXT;
  params TEXT := '';
BEGIN
  -- Get base URL from current bucket
  SELECT replace(system_url, '/supabase', '') INTO base_url 
  FROM supabase_functions.config;
  
  -- Add optional parameters
  IF width IS NOT NULL THEN
    params := params || format('width=%s&', width);
  END IF;
  
  IF height IS NOT NULL THEN
    params := params || format('height=%s&', height);
  END IF;
  
  IF format IS NOT NULL THEN
    params := params || format('format=%s&', format);
  END IF;
  
  -- Remove trailing '&' if params exist
  IF length(params) > 0 THEN
    params := '?' || left(params, length(params) - 1);
  END IF;
  
  -- Return properly formatted URL
  RETURN format('%s/storage/v1/render/image/public/%s/%s%s',
                base_url,
                bucket_name,
                file_path,
                params);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to test file URLs - returns both formats for testing
CREATE OR REPLACE FUNCTION public.test_storage_urls(
  bucket_name TEXT DEFAULT 'collection-images',
  file_path TEXT DEFAULT 'test.png'
)
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'object_url', public.get_storage_object_url(bucket_name, file_path),
    'render_url', public.get_storage_render_url(bucket_name, file_path),
    'render_url_with_params', public.get_storage_render_url(bucket_name, file_path, 800, 600, 'auto'),
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_storage_object_url(TEXT, TEXT) TO public, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_storage_render_url(TEXT, TEXT, INTEGER, INTEGER, TEXT) TO public, authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.test_storage_urls(TEXT, TEXT) TO public, authenticated, anon, service_role;

COMMIT; 