# Preview Feature for Hidden Content

This feature allows you to view hidden/unpublished collections and products by adding a `?preview` query parameter to any URL.

## How to Use

Add `?preview` to any collection or product URL to view hidden content:

### Examples

**Collection URLs:**
- Normal: `https://your-site.com/collection-slug`
- Preview: `https://your-site.com/collection-slug?preview`

**Product URLs:**
- Normal: `https://your-site.com/collection-slug/product-slug`  
- Preview: `https://your-site.com/collection-slug/product-slug?preview`

## What it Shows

When preview mode is enabled:

1. **Hidden Collections**: Collections with `visible: false` become accessible
2. **Hidden Products**: Products with `visible: false` are shown in collection listings
3. **Hidden Categories**: Categories with `visible: false` are displayed
4. **Visual Indicators**: A yellow banner appears at the top indicating preview mode
5. **Content Badges**: Hidden items show a "Hidden" badge with an eye-off icon

## Implementation Details

### Frontend Changes

- **Preview Utilities**: `src/utils/preview.ts` - Helper functions for detecting and managing preview mode
- **Query Updates**: Collection and product queries conditionally include hidden content
- **Visual Components**: 
  - `PreviewBanner` - Shows preview mode status
  - `HiddenContentBadge` - Indicates hidden items
- **Cache Awareness**: Separate cache keys for preview vs normal mode

### Database Queries

The system switches between different data sources based on preview mode:

**Normal Mode:**
- Uses `public_collections`, `public_products`, `public_categories` views
- These views automatically filter `visible = true`

**Preview Mode:**
- Uses full `collections`, `products`, `categories` tables
- Includes hidden content (no visibility filtering)
- Requires proper joins to get related data

### Security Considerations

- Currently allows any user to view hidden content via URL parameter
- Can be extended to check user permissions (admin, owner, etc.)
- Separate cache keys prevent hidden content from leaking to normal users

## Files Modified

1. **Core Utilities**:
   - `src/utils/preview.ts` (new)

2. **Hooks**:
   - `src/hooks/useCollection/query.ts`
   - `src/hooks/useCollection/index.ts` 
   - `src/hooks/useCollection.ts`
   - `src/hooks/useProduct.ts`

3. **Components**:
   - `src/components/ui/PreviewBanner.tsx` (new)
   - `src/components/ui/HiddenContentBadge.tsx` (new)
   - `src/App.tsx`

## Future Enhancements

1. **Permission Checks**: Restrict preview access to authorized users
2. **Admin Interface**: Toggle preview mode via UI controls
3. **Preview Links**: Generate shareable preview URLs
4. **Draft States**: Support for draft content beyond just hidden/visible
5. **Scheduled Publishing**: Preview content that will be published in the future 