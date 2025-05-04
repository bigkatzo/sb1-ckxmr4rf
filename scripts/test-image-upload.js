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

// Generate timestamp based filename
function generateUniqueFileName(originalName) {
  const extension = path.extname(originalName).toLowerCase();
  
  // Generate timestamp in consistent format
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/[T.]/g, '')
    .slice(0, 14);
  
  // Generate random string
  const randomString = Math.random().toString(36).substring(2, 14);
  
  return `${timestamp}-${randomString}${extension}`;
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
    
    // Generate safe filename
    const safeFileName = generateUniqueFileName(fileName);
    console.log(`Original filename: ${fileName}`);
    console.log(`Generated safe filename: ${safeFileName}`);
    
    // Upload file
    console.log(`Uploading to bucket: ${bucket}...`);
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(safeFileName, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
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
    console.log(`URL: ${urlData.publicUrl}`);
    
    // Try to get render URL for supported formats
    if (['.jpg', '.jpeg', '.png'].includes(path.extname(filePath).toLowerCase())) {
      const renderUrl = urlData.publicUrl
        .replace('/object/public', '/render/image/public')
        + '?width=800&quality=80&format=original';
      console.log(`Render URL: ${renderUrl}`);
    }
    
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