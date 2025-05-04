# Image Filename Generation Strategy

## Overview

This document describes the improved image filename generation strategy implemented to address issues with special characters in filenames and to ensure a more robust and consistent approach.

## Changes Implemented

### 1. Removed Original Filenames from Final Names

The primary change is that we no longer include any part of the original uploaded filename in the stored file. This eliminates issues with:
- Special characters (parentheses, spaces, non-ASCII characters, etc.)
- Inconsistent sanitization 
- Filenames that might contain problematic characters like emojis or scripts
- Potential conflicts with files that have similar names

### 2. New Filename Structure

New filenames follow this simple pattern:
```
TIMESTAMP-RANDOMSTRING.extension
```

Where:
- `TIMESTAMP` is a 14-character timestamp in format YYYYMMDDHHMMSS
- `RANDOMSTRING` is a random string (now 12 characters vs 8 previously)
- `extension` is the original file extension preserved in lowercase

Example: `20250502120000-ab12cd34ef56.jpg`

### 3. Increased Randomness

- Increased the random portion from 8 to 12 characters in client code
- Increased from 4 to 6 bytes in database functions
- This further reduces the chance of collision

### 4. Consistent Implementation

The same pattern is now used in:
- Client-side TS functions:
  - `generateUniqueFileName`
  - `generateSafeFilename`
- Database functions:
  - `generate_safe_storage_filename`

## Additional Optimizations

### 1. Image Compression

We've added automatic image compression during upload to reduce file size and improve page load times:

- Automatically compresses JPEG and PNG images before upload
- Limits maximum image dimensions to 1920px (preserving aspect ratio)
- Targets file size of 1-2MB maximum
- **Preserves WebP files intact without compression** to maintain their quality and format
- Skips compression for GIF and SVG files
- Falls back gracefully to original file if compression fails
- Adds optimization metadata for tracking

### 2. Improved URL Normalization

The URL normalization function has been enhanced to:

- Better handle different image formats (WebP, GIF, JPEG, PNG)
- Use object URLs for WebP files instead of render URLs to ensure compatibility
- Use the most appropriate rendering endpoint based on format
- More robustly handle malformed URLs
- Optimize rendering parameters for best quality/performance balance

### 3. WebP-Specific Handling

We've implemented special handling for WebP images:

- Detect WebP files by both MIME type and filename extension
- Skip the render transformation pipeline for WebP files
- Use direct object URLs for WebP files to prevent transcoding issues
- Add format metadata to track file types
- Improved extension detection and preservation

## Benefits

1. **Maximum Compatibility**: The new filenames contain only safe alphanumeric characters
2. **Guaranteed Uniqueness**: Combination of precise timestamp and longer random string
3. **Simplicity**: No need for complex sanitization logic  
4. **Performance**: Simpler processing with fewer regex operations
5. **Consistency**: Same naming pattern used across all components

## Testing

Added comprehensive tests in `src/tests/filenameGeneration.test.ts` to verify:
- Proper filename format
- Unique generation behavior 
- File extension handling
- Special character handling

## Migration

Updates are backward compatible:
- No changes to existing stored files
- Only affects newly uploaded files
- No API changes required

## Future Considerations

- Consider adding optional content hash for duplicate detection
- Monitor for any edge cases with unusual file extensions 