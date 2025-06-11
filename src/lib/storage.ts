import { supabase } from './supabase';
import { toast } from 'react-toastify';
import path from 'path';
import { format } from 'date-fns';
import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';

// For debugging storage issues
const DEBUG_STORAGE = false;

export type StorageBucket = 'collection-images' | 'product-images' | 'site-assets' | 'profile-images' | 'product-design-files' | 'collection-logos';

export interface UploadResult {
  path: string;
  url: string;
}

export interface UploadOptions {
  maxSizeMB?: number;
  cacheControl?: string;
  upsert?: boolean;
  webpHandling?: 'preserve' | 'optimize';
  onProgress?: (progress: number) => void;
  customPath?: string; // Custom path to use instead of auto-generating one
}

// Normalize storage URLs to ensure consistent format
export function normalizeStorageUrl(url: string): string {
  if (!url) return '';
  
  try {
    // Step 1: Verify this is a storage URL - if not, return unchanged
    if (!url.includes('/storage/v1/')) {
      return url;
    }

    // Step 2: Ensure there are no double slashes in the path (except in protocol)
    // This fixes issues with URLs like "storage/v1/object/public/bucket//filename.ext"
    const fixedUrl = url.replace(/([^:])\/\//g, '$1/');

    // Step 3: Parse the URL to handle it properly
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(fixedUrl);
    } catch (e) {
      // If we can't parse as full URL, try adding a base
      try {
        parsedUrl = new URL(fixedUrl, 'https://example.com');
      } catch {
        // If still can't parse, return the fixed URL
        return fixedUrl;
      }
    }
    
    // Step 4: Ensure HTTPS
    parsedUrl.protocol = 'https:';
    
    // Step 5: Get the path and determine format from extension
    const path = parsedUrl.pathname;
    
    // Step 6: ALWAYS PREFER OBJECT URLS - The render endpoint causes 400 errors
    // If this is already a render URL, convert to object URL
    if (path.includes('/storage/v1/render/image/public/')) {
      const objectPath = path.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
      return `${parsedUrl.protocol}//${parsedUrl.host}${objectPath}${parsedUrl.search}`;
    }
    
    // Already an object URL, just return it fixed
    if (path.includes('/storage/v1/object/public/')) {
      return `${parsedUrl.protocol}//${parsedUrl.host}${path}${parsedUrl.search}`;
    }
    
    // Not a storage URL we recognize, return the fixed URL
    return fixedUrl;
  } catch (error) {
    console.error('Error normalizing URL:', error, { originalUrl: url });
    // Fix double slashes in case the URL can't be parsed
    return url.replace(/([^:])\/\//g, '$1/');
  }
}

/**
 * Extract the filename from a Supabase storage URL or path
 * Works with both object and render URLs
 * @param url The storage URL or path
 * @returns The extracted filename
 */
export function extractFilenameFromStorageUrl(url: string): string {
  if (!url) return '';
  
  try {
    // Handle full URLs
    if (url.startsWith('http')) {
      const parsedUrl = new URL(url);
      const pathSegments = parsedUrl.pathname.split('/');
      // Get the last segment which should be the filename
      return pathSegments[pathSegments.length - 1] || '';
    }
    
    // Handle relative paths
    const pathSegments = url.split('/');
    return pathSegments[pathSegments.length - 1] || '';
  } catch (error) {
    console.error('Error extracting filename:', error);
    // If parsing fails, try a simple extraction
    const segments = url.split('/');
    return segments[segments.length - 1] || url;
  }
}

// Generate a unique filename with timestamp and random string
export function generateSafeFilename(originalName: string, collection = 'default'): string {
  const ext = path.extname(originalName);
  
  // Generate timestamp in a consistent format (YYYYMMDDHHMMSS)
  const timestamp = format(new Date(), "yyyyMMddHHmmss");
  
  // Generate a fixed-length random string (12 chars for more uniqueness)
  const randomString = crypto.randomBytes(6).toString('hex');
  
  // Always use the collection prefix directly - no need to check for duplication
  // since we're generating a completely new filename anyway
  
  // Construct final filename using collection-based format without separators
  return `${collection}${randomString}${timestamp}${ext}`;
}

// Verify file meets requirements
function validateFile(file: File, maxSizeMB: number = 5): void {
  if (!file.type.startsWith('image/')) {
    const error = new Error('Invalid file type. Only images are allowed.');
    toast.error(error.message);
    throw error;
  }

  const maxSize = maxSizeMB * 1024 * 1024;
  if (file.size > maxSize) {
    const error = new Error(`File size too large. Maximum size is ${maxSizeMB}MB.`);
    toast.error(error.message);
    throw error;
  }
}

// Helper function to fix duplicated bucket names in storage URLs
function fixDuplicatedBucketPath(url: string): string {
  if (!url) return url;
  
  const buckets = ['collection-images', 'product-images', 'site-assets', 'profile-images', 'product-design-files'];
  
  // First check for classic duplication pattern (/public/bucket/bucket/)
  for (const bucket of buckets) {
    // Pattern 1: /public/{bucket}/{bucket}/
    const duplicatedPattern1 = new RegExp(`/public/${bucket}/${bucket}/`);
    if (duplicatedPattern1.test(url)) {
      return url.replace(`/public/${bucket}/${bucket}/`, `/public/${bucket}/`);
    }
    
    // Pattern 2: /object/public/{bucket}/{bucket}/
    const duplicatedPattern2 = new RegExp(`/object/public/${bucket}/${bucket}/`);
    if (duplicatedPattern2.test(url)) {
      return url.replace(`/object/public/${bucket}/${bucket}/`, `/object/public/${bucket}/`);
    }
    
    // Pattern 3: /render/image/public/{bucket}/{bucket}/
    const duplicatedPattern3 = new RegExp(`/render/image/public/${bucket}/${bucket}/`);
    if (duplicatedPattern3.test(url)) {
      return url.replace(`/render/image/public/${bucket}/${bucket}/`, `/render/image/public/${bucket}/`);
    }
    
    // Pattern 4: /{bucket}/{bucket}/
    const duplicatedPattern4 = new RegExp(`/${bucket}/${bucket}/`);
    if (duplicatedPattern4.test(url)) {
      return url.replace(`/${bucket}/${bucket}/`, `/${bucket}/`);
    }
  }
  
  return url;
}

/**
 * Optimize an image before upload to reduce size
 * @param file The original file
 * @param options Optimization options
 * @returns Promise<File> The optimized file
 */
async function optimizeImageBeforeUpload(
  file: File, 
  options: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    preserveExif?: boolean;
    collection?: string;
  } = {}
): Promise<File> {
  // Check for WebP files both by MIME type and filename extension
  const isWebP = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp');
  const collection = options.collection || 'default';
  
  // Skip optimization for WebP, GIFs, SVGs, and design files
  if (isWebP || 
      file.type === 'image/gif' || 
      file.type === 'image/svg+xml' ||
      collection === 'productdesign' // Skip for design files
  ) {
    console.info(`Skipping optimization for ${file.type} file to preserve quality`);
    
    // Use our new collection-based format
    const newName = generateSafeFilename(file.name, collection);
    
    // Create a new File with consistent naming but keep the original content
    return new File(
      [file], 
      newName,
      { type: file.type }
    );
  }
  
  // Default options for good quality/size balance
  const compressionOptions = {
    maxSizeMB: options.maxSizeMB || 1,             // Default max file size of 1MB
    maxWidthOrHeight: options.maxWidthOrHeight || 1920, // Default max dimension
    useWebWorker: options.useWebWorker !== false,  // Use web worker by default
    preserveExif: options.preserveExif || false,   // Don't preserve EXIF data by default
    initialQuality: 0.8,                           // Initial quality setting
  };
  
  try {
    const compressedFile = await imageCompression(file, compressionOptions);
    
    // If the compressed file is larger than the original (rare case), return original
    if (compressedFile.size > file.size) {
      console.info('Compressed image is larger than original, using original');
      
      // Still use our new naming format
      const newName = generateSafeFilename(file.name, collection);
      return new File([file], newName, { type: file.type });
    }
    
    // Create a new File with our collection-based naming convention
    const newName = generateSafeFilename(file.name, collection);
    
    const optimizedFile = new File(
      [compressedFile], 
      newName,
      { type: compressedFile.type }
    );
    
    return optimizedFile;
  } catch (error) {
    console.warn('Image optimization failed, using original file:', error);
    
    // Still use our new naming convention
    const newName = generateSafeFilename(file.name, collection);
    return new File([file], newName, { type: file.type });
  }
}

/**
 * Upload an image to a specified storage bucket
 * @param file The file to upload
 * @param bucket The storage bucket to upload to
 * @param options Upload options
 * @returns Promise<string> The public URL of the uploaded image
 */
export async function uploadImage(
  file: File, 
  bucket: StorageBucket,
  options: UploadOptions = {}
): Promise<string> {
  const {
    maxSizeMB = 5,
    cacheControl = '604800',
    upsert = false,
    webpHandling,
    onProgress,
    customPath
  } = options;

  try {
    // Report initial progress
    if (onProgress) onProgress(0);
    
    // Debug info
    if (DEBUG_STORAGE) {
      console.log('Starting upload with options:', {
        file: {
          name: file.name,
          type: file.type,
          size: file.size
        },
        bucket,
        options
      });
    }
    
    // Detect WebP files both by MIME type and filename extension
    const isWebP = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp');
    const isDesignFile = bucket === 'product-design-files';
    
    // Validate the file first
    validateFile(file, maxSizeMB);
    
    // Determine collection from bucket
    const collection = bucket.replace(/-images$/, '')
                           .replace(/-assets$/, '')
                           .replace(/-/g, '');
    
    // WebP and design files need special handling
    let fileToUpload: File;
    
    if ((isWebP && webpHandling === 'preserve') || isDesignFile) {
      // For WebP and design files, bypass optimization completely and use original file
      // Use our collection-based naming format
      fileToUpload = new File(
        [file], 
        customPath || generateSafeFilename(file.name, collection),
        { type: file.type }
      );
      
      console.log(`Using preserve mode for ${file.name}. New filename: ${fileToUpload.name}`);
    } else {
      // For non-WebP files, use the normal optimization process with collection
      fileToUpload = await optimizeImageBeforeUpload(file, {
        maxSizeMB: Math.min(maxSizeMB, 2), // Keep at most 2MB even if allowed larger
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        collection 
      });
      
      // Apply custom path if provided (after optimization)
      if (customPath) {
        fileToUpload = new File(
          [fileToUpload], 
          customPath,
          { type: fileToUpload.type }
        );
        console.log(`Using custom path: ${customPath}`);
      }
    }
    
    // Use the filename that's already been safely generated during the previous steps
    const cleanPath = fileToUpload.name.replace(/^\/+|\/+$/g, '');

    // Handle content type mismatch for JSON issue
    let contentType = fileToUpload.type;
    // Force the correct content type if it's detected as application/json erroneously
    if ((contentType === 'application/json' || contentType === 'text/plain' || contentType === '') && 
        (cleanPath.match(/\.(jpe?g|png|gif|webp|bmp|svg)$/i))) {
      // Extract from filename extension as fallback
      const ext = cleanPath.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
      else if (ext === 'png') contentType = 'image/png';
      else if (ext === 'gif') contentType = 'image/gif';
      else if (ext === 'webp') contentType = 'image/webp';
      else if (ext === 'svg') contentType = 'image/svg+xml';
      else if (ext === 'bmp') contentType = 'image/bmp';
      console.warn(`Fixed incorrect content type from ${fileToUpload.type} to ${contentType}`);
      
      // Create a new File with the correct content type to ensure it's used throughout
      fileToUpload = new File([fileToUpload], fileToUpload.name, { type: contentType });
    }
    
    // Try upload with proper error handling
    let uploadData = null;
    
    try {
      // Create a custom FormData with properly named fields
      const formData = new FormData();
      formData.append('file', fileToUpload, fileToUpload.name);
      formData.append('cacheControl', cacheControl);
      formData.append('contentType', contentType);
      
      // Direct approach to ensure proper field naming
      const supabaseUrl = (supabase as any).supabaseUrl || 
                          import.meta.env.VITE_SUPABASE_URL;
      const token = await supabase.auth.getSession()
        .then(session => session.data.session?.access_token || '');
      
      // Extract just the filename without any path and avoid bucket name duplication
      const fileName = fileToUpload.name.split('/').pop() || fileToUpload.name;
      
      // Log the token length for debugging (don't log the full token)
      console.log(`Auth token present: ${Boolean(token)} (length: ${token?.length || 0})`);

      // Use object/public endpoint instead of render/image
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${fileName}`;
      console.log(`Uploading to: ${uploadUrl}`);
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-upsert': upsert ? 'true' : 'false'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      uploadData = await response.json();
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
    
    // If successful, get the public URL
    if (uploadData) {
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(cleanPath);

      // Return the object/public URL
      return publicUrl;
    }

    throw new Error('Failed to upload file after all attempts');
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

export function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  const normalized = parsed.pathname;
  const final = `${parsed.origin}${normalized}`;

  return final;
}

export async function uploadFile(
  supabase: SupabaseClient,
  file: File,
  bucket: string,
  collection = 'default'
): Promise<UploadResult> {
  const safeFileName = generateSafeFilename(file.name, collection);
  const cleanPath = safeFileName;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(cleanPath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;
  
  // Use our custom function to get the correct URL without duplication
  const publicUrl = getCorrectPublicUrl(supabase, bucket, cleanPath);
  
  // Convert to render URL if needed (though we prefer object URLs)
  const renderUrl = publicUrl.replace('/object/public', '/render/image/public');
  const finalUrl = normalizeUrl(renderUrl);

  return {
    path: cleanPath,
    url: finalUrl
  };
}

/**
 * Safely delete an image from a storage bucket
 * Note: Use with caution - consider retention policies for order history
 * @param path The path of the file in the bucket
 * @param bucket The storage bucket containing the file
 */
export async function deleteImage(
  path: string,
  bucket: StorageBucket
): Promise<void> {
  if (!path) return;
  
  try {
    // Extract the filename from the path/URL
    const filename = extractFilenameFromStorageUrl(path);
    if (!filename) {
      throw new Error('Could not determine filename from provided path');
    }
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filename]);
    
    if (error) {
      console.error('Storage deletion error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}

/**
 * Identify potentially orphaned images in a storage bucket
 * @param bucket The storage bucket to check
 * @param olderThan Optional date threshold - check images older than this date
 * @returns Promise<string[]> Array of potentially orphaned image paths
 */
export async function findOrphanedImages(
  bucket: StorageBucket,
  olderThan?: Date
): Promise<string[]> {
  try {
    // List all images in the bucket
    const { data: files, error } = await supabase.storage
      .from(bucket)
      .list();
    
    if (error) {
      console.error('Error listing storage files:', error);
      throw error;
    }
    
    if (!files || !files.length) return [];
    
    // Filter files by date if specified
    let filteredFiles = files;
    if (olderThan) {
      filteredFiles = files.filter(file => {
        // Use created_at from file metadata if available
        const createdAt = file.created_at ? new Date(file.created_at) : null;
        if (!createdAt) return false; // Skip files with no creation date
        return createdAt < olderThan;
      });
    }
    
    // Get file paths
    const filePaths = filteredFiles.map(file => file.name);
    
    return filePaths;
  } catch (error) {
    console.error('Error finding orphaned images:', error);
    throw error;
  }
}

/**
 * Utility function to handle image removal in a standardized way
 * This function doesn't delete the image from storage, just updates references
 * 
 * @param currentImages The current array of image URLs or single URL
 * @param indicesToRemove Indices to remove (for arrays) or true to remove entirely
 * @returns The updated image value (null, empty array, or filtered array)
 */
export function handleImageRemoval(
  currentImages: string | string[] | null | undefined,
  indicesToRemove: number[] | boolean
): string | string[] | null {
  // Handle empty input
  if (!currentImages) return null;
  
  // Handle single image (string)
  if (typeof currentImages === 'string') {
    return indicesToRemove ? null : currentImages;
  }
  
  // Handle array of images
  if (Array.isArray(currentImages)) {
    // Remove all images
    if (indicesToRemove === true) {
      return [];
    }
    
    // Remove specific indices
    if (Array.isArray(indicesToRemove) && indicesToRemove.length > 0) {
      return currentImages.filter((_, index) => !indicesToRemove.includes(index));
    }
    
    // No changes
    return currentImages;
  }
  
  // Fallback
  return null;
}

// Utility to verify file exists in bucket
export async function verifyFileInBucket(
  path: string, 
  bucket: StorageBucket
): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);
      
    if (error) {
      console.warn(`File verification failed for ${path} in ${bucket}:`, error);
      return false;
    }
    
    return data != null;
  } catch (error) {
    console.error(`Error verifying file ${path} in ${bucket}:`, error);
    return false;
  }
}

// Get diagnostic info about storage
export async function getStorageDiagnostics(
  bucket: StorageBucket = 'collection-images'
): Promise<Record<string, any>> {
  try {
    const { data: files, error: filesError } = await supabase.storage
      .from(bucket)
      .list('', { limit: 10 });
      
    const { data: bucketInfo, error: bucketError } = await supabase
      .from('storage.buckets')
      .select('*')
      .eq('id', bucket)
      .single();
      
    // Try to verify storage access permissions
    let accessTest = 'unknown';
    try {
      // Create a small test file in memory
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      const testFile = new File([testBlob], 'permission-test.txt', { type: 'text/plain' });
      
      // Try to upload it
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(`_test_${Date.now()}.txt`, testFile, { upsert: true });
        
      if (uploadError) {
        accessTest = `upload-failed: ${uploadError.message}`;
      } else if (uploadData) {
        // Try to delete it after upload
        const { error: deleteError } = await supabase.storage
          .from(bucket)
          .remove([uploadData.path]);
          
        accessTest = deleteError 
          ? `upload-success,delete-failed: ${deleteError.message}` 
          : 'success';
      }
    } catch (e) {
      accessTest = `test-error: ${(e as Error).message || String(e)}`;
    }
    
    return {
      bucket,
      bucketInfo: bucketInfo || null,
      bucketInfoError: bucketError?.message,
      files: files || [],
      filesError: filesError?.message,
      timestamp: new Date().toISOString(),
      accessTest,
      serviceStatus: {
        sdk: supabase !== null,
        auth: Boolean(await supabase.auth.getSession().then(s => s.data.session))
      }
    };
  } catch (error) {
    return {
      bucket,
      error: (error as Error).message || String(error),
      timestamp: new Date().toISOString(),
      serviceStatus: {
        sdk: supabase !== null
      }
    };
  }
}

// After the normalizeUrl function, add this new function:
export function getCorrectPublicUrl(supabase: SupabaseClient, bucket: string, path: string): string {
  // Get the base URL from the Supabase client
  const supabaseUrl = (supabase as any).supabaseUrl || 
                      import.meta.env.VITE_SUPABASE_URL;
  
  // Ensure path doesn't start with a bucket name already
  let cleanPath = path;
  if (cleanPath.startsWith(`${bucket}/`)) {
    cleanPath = cleanPath.replace(`${bucket}/`, '');
  }
  
  // Just use the filename without any path
  const fileName = cleanPath.split('/').pop() || cleanPath;
  
  // Construct URL properly without duplication
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${fileName}`;
  
  return publicUrl;
}

/**
 * Function to check if a file exists in Supabase storage and get its working public URL
 * This is useful when database triggers might modify the URL with timestamps
 */
export async function getWorkingStorageUrl(url: string): Promise<string | null> {
  try {
    // Check if the URL works
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return url; // URL works fine
    }
    
    // If URL doesn't work, apply fix for any duplicated bucket paths
    const fixedUrl = fixDuplicatedBucketPath(url);
    if (fixedUrl !== url) {
      // Try the fixed URL
      const fixedController = new AbortController();
      const fixedTimeoutId = setTimeout(() => fixedController.abort(), 3000);
      
      const fixedResponse = await fetch(fixedUrl, { 
        method: 'HEAD',
        signal: fixedController.signal
      });
      clearTimeout(fixedTimeoutId);
      
      if (fixedResponse.ok) {
        return fixedUrl;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Error checking storage URL:', error);
    return null;
  }
} 