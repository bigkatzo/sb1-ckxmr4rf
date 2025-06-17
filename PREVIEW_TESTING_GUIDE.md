# Preview Feature Testing Guide

## Overview
The preview feature allows users to view hidden/unpublished content by adding `?preview` to any URL. This guide covers all the improvements made and how to test them.

## Recent Improvements Made

### 1. Enhanced ProductPage Component
- **Preview Mode Detection**: Added state tracking to detect preview mode changes
- **Improved Navigation**: Better handling when returning to collection pages
- **Cache Management**: Proper cache clearing when preview mode changes
- **State Consistency**: Ensures preview state is maintained properly across navigation

### 2. Navigation Flow Improvements
- **Product Grid**: Already correctly passes `window.location.search` when navigating to products
- **Product Modal**: Collection link properly maintains preview parameter  
- **Product Page**: `handleClose` function now properly maintains preview state
- **Browser Back/Forward**: Handles preview parameter correctly during history navigation

### 3. Cache and State Management
- **Preview-Aware Caching**: Separate cache keys for preview vs normal mode
- **Cache Invalidation**: Automatic cache clearing when preview mode changes
- **State Synchronization**: Prevents inconsistent state between preview and normal modes

## Testing Scenarios

### Scenario 1: Basic Preview Navigation
**Test Steps:**
1. Navigate to any collection (e.g., `/test-collection`)
2. Add `?preview` to the URL manually (e.g., `/test-collection?preview`)
3. Verify preview banner appears at bottom-right
4. Click on any product card
5. **Expected**: Product page opens with `?preview` parameter maintained
6. **Expected**: Preview banner still visible on product page

### Scenario 2: Collection to Product Navigation
**Test Steps:**
1. Start at collection with preview: `/collection-slug?preview`
2. Click on a product
3. **Expected**: URL becomes `/collection-slug/product-slug?preview`
4. **Expected**: Product data includes hidden items if any
5. **Expected**: Preview banner remains visible

### Scenario 3: Product Modal Close Navigation
**Test Steps:**
1. Open product from preview collection: `/collection-slug/product-slug?preview`
2. Click the X button or press Escape to close
3. **Expected**: Returns to `/collection-slug?preview`
4. **Expected**: Maintains scroll position and selected category
5. **Expected**: Preview banner still visible

### Scenario 4: Preview Parameter Removal
**Test Steps:**
1. Navigate to `/collection-slug/product-slug?preview`
2. Manually remove `?preview` from URL
3. **Expected**: Page reloads automatically to ensure clean state
4. **Expected**: Product data now excludes hidden items
5. **Expected**: Preview banner disappears

### Scenario 5: Collection Link in Product Modal
**Test Steps:**
1. Open product with preview: `/collection-slug/product-slug?preview`
2. Click on the collection name link in the product modal
3. **Expected**: Returns to `/collection-slug?preview`
4. **Expected**: Preview banner remains visible
5. **Expected**: Hidden products visible in collection

### Scenario 6: Cross-Collection Navigation
**Test Steps:**
1. Start at collection A with preview: `/collection-a?preview`
2. Navigate to different collection B: `/collection-b`
3. **Expected**: Preview parameter automatically removed
4. **Expected**: Page reloads to ensure clean state
5. **Expected**: Only visible products shown in collection B

## Browser Console Testing

You can use the testing utilities in the browser console:

```javascript
// Test preview functionality
testPreviewNavigation()

// Enable preview mode on current page
enablePreviewMode()

// Disable preview mode on current page  
disablePreviewMode()
```

## Expected Behaviors

### ✅ What Should Work
- [ ] Preview parameter inherited during product navigation
- [ ] Preview banner appears when `?preview` is present
- [ ] Hidden products/collections become visible in preview mode
- [ ] Cache keys are different for preview vs normal mode
- [ ] Navigation maintains preview state consistently
- [ ] Preview mode can be toggled on/off without issues

### ⚠️ Edge Cases to Watch
- [ ] Fast navigation between preview/normal modes
- [ ] Browser back/forward with preview parameter
- [ ] Direct URL access with preview parameter
- [ ] Cache persistence across sessions
- [ ] Mobile touch navigation with preview mode

### 🚫 What Should NOT Happen
- [ ] Preview parameter appearing when not intended
- [ ] Hidden content leaking to normal mode
- [ ] Inconsistent state between preview and normal modes
- [ ] Cache contamination between modes
- [ ] Preview banner showing without preview parameter

## Technical Implementation Notes

### Key Files Modified
- `src/pages/ProductPage.tsx` - Enhanced preview state tracking
- `src/components/products/ProductGrid.tsx` - Already properly handles preview inheritance
- `src/components/products/ProductModal.tsx` - Collection link maintains preview state
- `src/utils/preview.ts` - Core preview utility functions
- `src/components/ui/PreviewBanner.tsx` - Preview mode indicator
- `src/components/ui/ScrollBehavior.tsx` - Handles preview during navigation

### Cache Strategy
- Normal mode: Uses cache keys like `product:collection:slug`
- Preview mode: Uses cache keys like `product:collection:slug:preview`
- Automatic cache invalidation when switching modes
- Separate query paths for preview vs normal data

### Security Considerations
- Currently open to all users via URL parameter
- Future enhancement: Restrict to authenticated users
- No hidden content contamination in normal mode
- Preview cache is properly isolated

## Troubleshooting

### If Preview Mode Doesn't Work
1. Check browser console for errors
2. Verify `?preview` parameter is present in URL
3. Check if PreviewBanner component is visible
4. Clear browser cache and try again
5. Test with different products/collections

### If Navigation Breaks Preview
1. Check that `window.location.search` is being passed in navigation
2. Verify cache keys include `:preview` suffix when in preview mode
3. Check that state is properly maintained in navigation calls
4. Look for console warnings about cache invalidation

## Performance Notes
- Preview mode uses separate cache to avoid contamination
- Cache invalidation happens automatically when toggling modes
- Service worker prefetching respects preview state
- Background revalidation works independently for each mode 