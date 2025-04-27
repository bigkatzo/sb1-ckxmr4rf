# Image Handling Test Plan

This document outlines manual tests to verify the fixed image handling system.

## URL Normalization Tests

### Test with standard JPG/PNG URLs
1. Test URL: `https://example.com/storage/v1/object/public/product-images/test.jpg`
2. Expected behavior: 
   - Should convert to render URL format: `/storage/v1/render/image/public/`
   - Should add width, quality, and format parameters

### Test with URLs containing parentheses
1. Test URL: `https://example.com/storage/v1/object/public/product-images/test(1).jpg`
2. Expected behavior:
   - Should use object URL format: `/storage/v1/object/public/`
   - Should properly encode the parentheses (not remove them)
   - Should not include query parameters

### Test with URLs containing spaces
1. Test URL: `https://example.com/storage/v1/object/public/product-images/test image.jpg`
2. Expected behavior:
   - Should convert spaces to hyphens: `test-image.jpg`
   - Should use object URL format for URLs with spaces

### Test with WebP format
1. Test URL: `https://example.com/storage/v1/object/public/product-images/test.webp`
2. Expected behavior:
   - Should keep as object URL format: `/storage/v1/object/public/`
   - Should not add transformation parameters

## Filename Sanitization Tests

### Test with allowed characters
1. Input: `test_file-name.jpg`
2. Expected output: `test_file-name.jpg`
3. Verify: All underscores, hyphens, and dots should be preserved

### Test with special characters
1. Input: `test (1) file & name.jpg`
2. Expected output: `test-1-file-name.jpg`
3. Verify: Spaces and special characters should be replaced with hyphens

### Test with multiple special characters
1. Input: `test! @#$% ^&*()_+ file.jpg`
2. Expected output: `test-_-file.jpg` 
3. Verify: Only allowed characters should remain, others replaced with hyphens

## Unique Filename Generation Tests

### Test basic filename generation
1. Input: `test.jpg`
2. Expected output format: `YYYYMMDDHHMMSS-randomstring-test.jpg`
3. Verify: Output follows pattern with timestamp, random string, and sanitized name

### Test with special characters in original name
1. Input: `Test File (1).jpg`
2. Expected output format: `YYYYMMDDHHMMSS-randomstring-test-file-1.jpg`
3. Verify: Original name should be properly sanitized in the final filename

## End-to-End Upload Tests

### Test upload with normal filename
1. Upload a file with a simple name: `product.jpg`
2. Verify: Upload succeeds and image displays correctly

### Test upload with special characters
1. Upload a file with special characters: `product (1).jpg`
2. Verify: Upload succeeds and image displays correctly

### Test upload with WebP format
1. Upload a WebP file: `product.webp`
2. Verify: Upload succeeds and image displays correctly 