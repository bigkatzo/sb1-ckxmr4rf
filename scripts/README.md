# Scripts Directory

This directory contains utility scripts for development and testing.

## Available Scripts

### `test-image-upload.js`

This script allows testing the image upload functionality with various file types to verify our new naming and optimization strategy.

#### Requirements

- Node.js
- `.env` file with the following variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Usage

```bash
node scripts/test-image-upload.js <image-path> [bucket-name]
```

#### Example

```bash
# Upload to default bucket (product-images)
node scripts/test-image-upload.js ./test-images/sample.jpg

# Upload to a specific bucket
node scripts/test-image-upload.js ./test-images/sample.webp collection-images
```

#### Output

The script will output:
- The original filename
- The generated safe filename
- The upload bucket
- The storage path
- The public URL
- The render URL (for JPG/PNG files)

#### Testing Different File Formats

To test the improved file naming and storage strategy, try uploading various file types:

1. Files with spaces and special characters: `my file (1).jpg`
2. Files with unicode characters: `ロゴ.png`
3. Different image formats: `.jpg`, `.png`, `.webp`, `.gif`

This will help verify that our new system is handling all cases correctly. 