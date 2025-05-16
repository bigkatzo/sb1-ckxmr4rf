#!/usr/bin/env node

/**
 * Test Image Upload Script
 * 
 * This script allows testing the image upload functionality with various file types
 * to verify our new naming and optimization strategy.
 * 
 * Usage:
 *   node scripts/test-image-upload.js <image-path> [bucket-name]
 * 
 * Example:
 *   node scripts/test-image-upload.js ./test-images/sample.jpg product-images
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase URL and key must be provided in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to get file MIME type based on extension
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Generate a safe filename with consistent format across frontend and backend
 * @param {string} originalName - Original filename
 * @param {string} collection - Collection identifier (e.g., 'product', 'collection')
 * @returns {string} - Safe filename with timestamp and random hex
 */
function generateSafeFilename(originalName, collection = 'default') {
  const ext = path.extname(originalName);
  
  // Generate timestamp in a consistent format (YYYYMMDDHHMMSS)
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/[T.]/g, '')
    .slice(0, 14);
  
  // Generate a fixed-length random string (12 chars)
  const randomString = crypto.randomBytes(6).toString('hex');
  
  // Always use the collection prefix directly - no need to check for duplication
  // since we're generating a completely new filename anyway
  
  // Construct final filename using collection-based format without separators
  return `${collection}${randomString}${timestamp}${ext}`;
}

// Main upload function
async function uploadImage(filePath, bucket) {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    
    // Read file
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const contentType = getMimeType(filePath);
    const isWebP = contentType === 'image/webp';
    
    // Determine collection from bucket for consistent naming
    const collection = bucket.replace(/-images$/, '')
                            .replace(/-assets$/, '')
                            .replace(/-/g, '');
    
    // Generate safe filename using our standard function
    const safeFileName = generateSafeFilename(fileName, collection);
    console.log(`Original filename: ${fileName}`);
    console.log(`File type: ${contentType}`);
    console.log(`Collection prefix: ${collection}`);
    console.log(`Generated safe filename: ${safeFileName}`);
    
    // Upload file
    console.log(`Uploading to bucket: ${bucket}...`);
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(safeFileName, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
        metadata: {
          format: isWebP ? 'webp' : path.extname(filePath).replace('.', ''),
          originalName: fileName,
          testing: 'true'
        }
      });
    
    if (error) {
      console.error('Upload error:', error);
      process.exit(1);
    }
    
    // Get URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);
    
    console.log('\nUpload successful!');
    console.log(`Path: ${data.path}`);
    console.log(`Object URL: ${urlData.publicUrl}`);
    
    // For WebP files, don't try to create a render URL
    if (isWebP) {
      console.log('\nFormat: WebP - using direct object URL for compatibility');
    } else if (['.jpg', '.jpeg', '.png'].includes(path.extname(filePath).toLowerCase())) {
      // Create render URL for supported formats
      const renderUrl = urlData.publicUrl
        .replace('/object/public', '/render/image/public')
        + '?width=800&quality=80&format=original';
      console.log(`Render URL: ${renderUrl}`);
    }
    
    // Verify format detection and extension
    const fileExt = path.extname(data.path).toLowerCase();
    const expectedExt = path.extname(filePath).toLowerCase();
    if (fileExt !== expectedExt) {
      console.warn(`\nWarning: File extension mismatch. Original: ${expectedExt}, Stored: ${fileExt}`);
    }
    
    // Provide a verification command
    console.log('\nTo verify the file was uploaded correctly, you can:');
    console.log(`1. View it in browser: ${urlData.publicUrl}`);
    console.log(`2. Download it: curl -o test_download${fileExt} "${urlData.publicUrl}"`);
    
    return data;
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  // Check arguments
  const [,, filePath, bucketName = 'product-images'] = process.argv;
  
  if (!filePath) {
    console.error('Error: Please provide a file path');
    console.log('Usage: node scripts/test-image-upload.js <image-path> [bucket-name]');
    process.exit(1);
  }
  
  // Run upload
  uploadImage(filePath, bucketName)
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
} 