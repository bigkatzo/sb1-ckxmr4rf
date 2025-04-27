# Image Upload Fix Documentation

## Issue Background

In commit `55beca94` (April 25, 2025), improvements were made to the image handling system to properly display images with special characters in filenames, such as parentheses, spaces, and hyphens. While this fixed display issues, it had unintended consequences on the image upload functionality.

## What Broke

The modified image upload functionality attempted to handle special characters by:

1. Overriding the existing filename sanitization process with a more aggressive approach
2. Completely removing special characters like parentheses instead of properly encoding them
3. Using a new URL normalization approach that interfered with the upload process

These changes caused the following issues:
- Image uploads failed for files with special characters
- Some files were potentially uploaded in unsupported formats
- The URL paths were not consistently handled between upload and display

## The Fix

Our solution restores the pre-existing upload form functionality while maintaining the image display improvements:

1. Restored the original `uploadImage` function that was working before
2. Improved the `sanitizeFileName` function to:
   - Better handle special characters
   - Preserve more non-problematic characters (underscores, hyphens, dots)
   - Ensure consistent filename generation
   
3. Updated the `normalizeStorageUrl` function to:
   - Handle special characters properly in URLs
   - Preserve encoded parentheses instead of removing them
   - Use consistent URL formats for different file types

4. Fixed the `OptimizedImage` component's error recovery to:
   - Use the same encoding approach as `normalizeStorageUrl`
   - Better handle image loading fallbacks
   - Preserve special characters in consistent ways

## Technical Implementation

### Storage URL Handling

- Normal images (JPG/PNG without special chars) use: `/storage/v1/render/image/public/`
- WebP images or files with special characters use: `/storage/v1/object/public/`
- Special characters are encoded consistently across components

### File Naming Logic

- Files are uploaded with sanitized names in format: `timestamp-randomstring-sanitizedname.ext`
- Sanitized names preserve underscores, hyphens and dots
- Special characters like parentheses and spaces are replaced with hyphens or encoded properly in URLs

### Tests

Created a test file (`src/tests/imageHandling.test.ts`) to verify:
- URL normalization works properly for different file types
- Filename sanitization handles special characters correctly
- Unique filename generation follows the correct pattern

## Key Takeaways

1. The issue was in the overly aggressive special character handling that was removing parentheses entirely
2. The fix keeps the display improvements but restores the working upload functionality
3. Special characters in filenames are now handled consistently throughout the application

## Future Recommendations

1. Consider using a more consistent approach between object and render URLs
2. Monitor uploads of non-standard image formats (WebP, etc.) for issues
3. Create unit tests for critical image handling functions
4. Document the expected behavior of image URL handling across the application 