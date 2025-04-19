# Supabase Storage URL Migration Guide

## Issue

Images stored in Supabase that were previously accessible via the `/storage/v1/object/public/` endpoint have become inaccessible. This is due to Supabase changing their storage access policies, requiring images to be accessed through the `/storage/v1/render/image/public/` endpoint instead.

### Examples

**Old (broken) URL format:**
```
https://[project-id].supabase.co/storage/v1/object/public/[bucket]/[filename]
```

**New (working) URL format:**
```
https://[project-id].supabase.co/storage/v1/render/image/public/[bucket]/[filename]
```

## Solutions Implemented

We've implemented several fixes to address this issue:

### 1. Database URL Migration

A script has been created to update all image URLs stored in the database:
- Located at: `migrations/fix_image_urls.js`
- Transforms all object URLs to render URLs
- Updates records in collections, products, and user_profiles tables

To run this migration:
```bash
cd migrations
npm install dotenv @supabase/supabase-js
node fix_image_urls.js
```

### 2. Frontend URL Normalization

The `normalizeStorageUrl` function in `src/lib/storage.ts` has been updated to:
- Always convert object URLs to render URLs for images
- Handle fallback scenarios for non-image files
- Implement more robust error handling

### 3. Enhanced Image Component Error Handling

The `OptimizedImage` component now has a sophisticated error recovery mechanism:
- First tries the render endpoint without query parameters
- Then falls back to the object endpoint if needed
- For older URLs using the object endpoint, tries the render endpoint
- Finally falls back to the original source URL

## Preventative Measures

To avoid similar issues in the future:

1. **URL Storage Policy**: Always store normalized URLs in the database
2. **Upload Function**: Our `uploadImage` function now always returns render URLs
3. **Storage Policies**: SQL migrations ensure proper Supabase storage bucket policies

## Troubleshooting

If you still encounter image loading issues:

1. Check browser console for image load errors
2. Verify the URL format (should use `/storage/v1/render/image/public/`)
3. Check Supabase storage bucket permissions
4. Try manually converting a problematic URL using the patterns above

## Future Considerations

1. Consider implementing a CDN for improved image delivery and caching
2. Monitor Supabase storage policy changes in their documentation
3. Implement regular database audits to detect and fix broken image URLs 