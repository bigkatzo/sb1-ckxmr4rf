# Storage Bucket Fix

## Issue

A recent migration for adding the new `site-assets` bucket broke the functionality of the existing `collection-images` and `product-images` buckets. This resulted in upload errors like:

```
Failed to load resource: the server responded with a status of 500 ()
Storage bucket 'collection-images' error: Object
Upload error: Object
Error with collection: Error: Failed to upload collection image. Please try again.
```

## Root Cause

1. The `StorageBucket` type in the frontend code did not include the new `site-assets` bucket
2. The storage policies in Supabase were not properly updated to include all buckets

## Solution

This fix addresses both issues:

1. Updated the `StorageBucket` type in `src/lib/storage.ts` to include 'site-assets'
2. Created a new SQL migration (`supabase/migrations/20250516000100_fix_storage_policies.sql`) that:
   - Ensures all three buckets exist with proper configuration
   - Drops all existing policies to avoid conflicts
   - Creates new comprehensive policies that allow access to all buckets
   - Enables RLS and grants necessary permissions

## Deployment Steps

1. Deploy the frontend code changes:
   ```bash
   git push origin main  # or your deployment branch
   ```

2. Apply the new SQL migration to the Supabase project:
   ```bash
   npx supabase migration up
   ```
   
   If running against a production Supabase instance:
   ```bash
   npx supabase migration up --db-url YOUR_SUPABASE_CONNECTION_STRING
   ```

3. Restart your frontend application to ensure the TypeScript changes take effect.

## Verification

After deploying the changes, verify the fix by:

1. Uploading a new collection image
2. Uploading a new product image
3. Uploading a site asset

All uploads should succeed and the images should be accessible. 