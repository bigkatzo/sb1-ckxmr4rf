import { supabase } from './supabase';
import { toast } from 'react-toastify';
import path from 'path';
import { format } from 'date-fns';
import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';

// For debugging storage issues
const DEBUG_STORAGE = false;

export type StorageBucket = 'collection-images' | 'product-images' | 'site-assets' | 'profile-images';

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

// Sanitize filename to remove problematic characters
export function sanitizeFileName(fileName: string): string {
  // Remove any path traversal characters and get the base name
  const name = fileName.replace(/^.*[/\\]/, '');
  
  // Remove dimensions and other common problematic patterns
  const cleaned = name
    .replace(/[-_]?\d+x\d+[-_]?/g, '') // Remove dimensions like 1500x500
    .replace(/[-_]?\d{13,}[-_]?/g, '') // Remove long numbers (timestamps)
    .replace(/[-_]?copy[-_]?\d*$/i, '') // Remove "copy" and "copy 1", etc.
    .replace(/[-_]?new[-_]?\d*$/i, ''); // Remove "new" and "new 1", etc.
  
  // Convert to lowercase and normalize characters
  const sanitized = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-') // Replace non-alphanumeric with single hyphen
    .replace(/-+/g, '-')          // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
    .replace(/^\.+|\.+$/g, '');   // Remove leading/trailing dots
  
  return sanitized;
}

// Generate a unique filename with timestamp and random string
export function generateUniqueFileName(originalName: string, collection = 'default'): string {
  // Extract extension safely
  const extension = (originalName.match(/\.[^/.]+$/)?.[0] || '').toLowerCase();
  
  // Generate timestamp in a consistent format (YYYYMMDDHHMMSS)
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/[T.]/g, '')
    .slice(0, 14);
  
  // Generate a fixed-length random string (12 chars for more uniqueness)
  const randomString = Math.random().toString(36).substring(2, 14);
  
  // Construct final filename using collection-based format without separators
  return `${collection}${randomString}${timestamp}${extension}`;
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

// Verify URL is accessible
async function verifyUrlAccessibility(url: string): Promise<void> {
  try {
    // For render URLs, convert to object URL for verification since render sometimes returns 400
    let urlToVerify = url;
    if (url.includes('/storage/v1/render/image/public/')) {
      urlToVerify = url.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
      console.log('Converting render URL to object URL for verification:', urlToVerify);
    }
    
    // Use a longer timeout for slow networks
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(urlToVerify, { 
      method: 'HEAD',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn('Warning: Generated image URL may not be publicly accessible:', {
        status: response.status,
        url: urlToVerify
      });
      
      // If object URL check failed, try direct bucket URL as last resort
      if (urlToVerify !== url && urlToVerify.includes('/storage/v1/object/public/')) {
        // Extract bucket and path
        const parts = urlToVerify.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/);
        if (parts && parts.length >= 3) {
          const [, bucket, path] = parts;
          const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);
          
          console.log('Trying direct bucket URL:', publicUrl);
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not verify image URL accessibility (timeout or network error):', error);
  }
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
  
  // Skip optimization for WebP, GIFs, and SVGs
  if (isWebP || file.type === 'image/gif' || file.type === 'image/svg+xml') {
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
    onProgress
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
    
    // Validate the file first
    validateFile(file, maxSizeMB);
    
    // Determine collection from bucket
    const collection = bucket.replace(/-images$/, '')
                           .replace(/-assets$/, '')
                           .replace(/-/g, '');
    
    // WebP files need special handling
    let fileToUpload: File;
    
    if (isWebP && webpHandling === 'preserve') {
      // For WebP, bypass optimization completely and use original file
      // Use our collection-based naming format
      fileToUpload = new File(
        [file], 
        generateSafeFilename(file.name, collection),
        { type: 'image/webp' }
      );
      
      console.log(`Using WebP preserve mode for ${file.name}. New filename: ${fileToUpload.name}`);
    } else {
      // For non-WebP files, use the normal optimization process with collection
      fileToUpload = await optimizeImageBeforeUpload(file, {
        maxSizeMB: Math.min(maxSizeMB, 2), // Keep at most 2MB even if allowed larger
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        collection 
      });
    }
    
    // Use the filename that's already been safely generated during the previous steps
    const cleanPath = fileToUpload.name.replace(/^\/+|\/+$/g, '');

    // Add metadata to track image association and upload time
    const metadata = {
      contentType: fileToUpload.type,
      cacheControl,
      // Add tracking metadata
      lastAccessed: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      associatedEntity: bucket === 'collection-images' 
        ? 'collection' 
        : bucket === 'product-images' 
          ? 'product' 
          : 'site',
      optimized: isWebP && webpHandling === 'preserve' ? 'false' : 'true',
      format: isWebP ? 'webp' : (fileToUpload.type.split('/')[1] || 'unknown')
    };

    console.log(`Uploading ${isWebP ? 'WebP' : 'image'} file to ${bucket}: ${cleanPath}`);
    
    // Handle content type mismatch for JSON issue
    let contentType = fileToUpload.type;
    // Force the correct content type if it's detected as application/json erroneously
    if (contentType === 'application/json' && 
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
    }
    
    // Try three different upload methods with proper error handling
    let uploadData = null;
    let uploadError = null;
    
    // Method 1: Standard upload (most reliable)
    try {
      const result = await supabase.storage
        .from(bucket)
        .upload(cleanPath, fileToUpload, {
          cacheControl,
          contentType,
          upsert,
          metadata
        });
        
      uploadData = result.data;
      uploadError = result.error;
      
      if (!uploadError && uploadData) {
        console.log("Upload succeeded with standard method");
      } else {
        console.warn("Standard upload failed, trying alternative methods", uploadError);
      }
    } catch (err) {
      console.warn("Standard upload threw exception:", err);
      uploadError = err;
    }
    
    // Method 2: If the first method failed, try FormData approach
    if (uploadError && !uploadData) {
      try {
        const formData = new FormData();
        // Properly name the file field as 'file'
        formData.append('file', fileToUpload);
        
        // Add required metadata fields separately
        formData.append('cacheControl', cacheControl);
        formData.append('contentType', contentType);
        
        // Metadata as JSON string
        const metadataString = JSON.stringify(metadata);
        formData.append('metadata', metadataString);
        
        // Progress tracking with XMLHttpRequest
        if (onProgress) {
          return new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (event) => {
              if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                onProgress(percentComplete);
              }
            });
            
            xhr.addEventListener('load', async () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const data = JSON.parse(xhr.responseText);
                  const { data: { publicUrl } } = supabase.storage
                    .from(bucket)
                    .getPublicUrl(data.Key || cleanPath);
                  
                  // Ensure we always use an object URL
                  const fixedUrl = publicUrl.replace(/([^:])\/\//g, '$1/');
                  const finalUrl = fixedUrl.includes('/storage/v1/render/image/') 
                    ? fixedUrl.replace('/storage/v1/render/image/', '/storage/v1/object/') 
                    : fixedUrl;
                    
                  onProgress(100);
                  resolve(finalUrl);
                } catch (err) {
                  reject(err);
                }
              } else {
                reject(new Error(`XHR upload failed with status ${xhr.status}`));
              }
            });
            
            xhr.addEventListener('error', () => {
              reject(new Error('XHR upload failed'));
            });
            
            xhr.addEventListener('abort', () => {
              reject(new Error('XHR upload aborted'));
            });
            
            // Get URL and token safely
            supabase.auth.getSession().then(session => {
              const token = session.data.session?.access_token || '';
              const supabaseUrl = (supabase as any).supabaseUrl || 
                                  import.meta.env.VITE_SUPABASE_URL;
              
              xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${cleanPath}`);
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
              xhr.setRequestHeader('x-upsert', upsert ? 'true' : 'false');
              xhr.send(formData);
            }).catch(reject);
          });
        }
        
        // Direct API endpoint approach (bypass SDK issues)
        // Get URL and token safely
        const supabaseUrl = (supabase as any).supabaseUrl || 
                           process.env.VITE_SUPABASE_URL || 
                           import.meta.env.VITE_SUPABASE_URL;
        const token = supabase.auth.getSession()
          .then(session => session.data.session?.access_token || '')
          .catch(() => '');
                           
        const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${cleanPath}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await token}`,
            'x-upsert': upsert ? 'true' : 'false',
            // Explicitly set a multipart form boundary
            'Content-Type': 'multipart/form-data'
          },
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          uploadData = { path: data.Key || cleanPath };
          uploadError = null;
          console.log("Upload succeeded with FormData method");
        } else {
          const errorData = await response.json();
          console.warn("FormData upload failed:", errorData);
        }
      } catch (err) {
        console.warn("FormData upload threw exception:", err);
      }
    }
    
    // Method 3: Direct binary upload (last resort)
    if (uploadError && !uploadData) {
      try {
        console.log("Attempting binary upload as last resort");
        
        // Get the file as a binary blob
        const buffer = await fileToUpload.arrayBuffer();
        
        // Use raw upload with ArrayBuffer
        const result = await supabase.storage
          .from(bucket)
          .upload(cleanPath, buffer, {
            contentType, // Use the corrected content type
            cacheControl,
            upsert
          });
          
        uploadData = result.data;
        uploadError = result.error;
        
        if (!uploadError && uploadData) {
          console.log("Upload succeeded with binary method");
        } else {
          console.warn("Binary upload also failed:", uploadError);
          
          // Last ditch effort - try with Blob instead of ArrayBuffer
          if (uploadError) {
            const blobData = new Blob([fileToUpload], { type: contentType });
            const blobResult = await supabase.storage
              .from(bucket)
              .upload(cleanPath, blobData, {
                contentType,
                cacheControl,
                upsert
              });
              
            uploadData = blobResult.data;
            uploadError = blobResult.error;
            
            if (!uploadError && uploadData) {
              console.log("Upload succeeded with Blob method");
            } else {
              console.warn("Blob upload also failed:", uploadError);
            }
          }
        }
      } catch (err) {
        console.warn("Binary upload threw exception:", err);
        uploadError = err;
      }
    }

    // Method 4: Server-side upload fallback (absolute last resort)
    if (uploadError && !uploadData) {
      try {
        console.log("Attempting server-side upload as final fallback");
        
        // Create a simple FormData
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('bucket', bucket);
        formData.append('path', cleanPath);
        formData.append('contentType', contentType);
        
        // Use a Netlify function or similar server endpoint
        const serverUploadUrl = `${window.location.origin}/.netlify/functions/upload-file-fallback`;
        const response = await fetch(serverUploadUrl, {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.url) {
            console.log("Upload succeeded with server-side method");
            return data.url; // Direct return since we already have the URL
          }
        } else {
          console.warn("Server-side upload failed as well");
        }
      } catch (err) {
        console.warn("Server-side upload threw exception:", err);
      }
    }

    // Final error handling if all methods failed
    if (uploadError || !uploadData) {
      // Extract more detailed error information
      const statusCode = 
        (uploadError as any)?.statusCode || 
        (uploadError as any)?.status || 
        (uploadError as any)?.code || 
        'unknown';
        
      const errorMessage = 
        (uploadError as any)?.message || 
        (uploadError as any)?.error_description || 
        (uploadError as any)?.error || 
        'Unknown error';
      
      if (errorMessage.includes('bucket') || statusCode === 400) {
        console.error(`Storage bucket '${bucket}' error (${statusCode}):`, uploadError);
        toast.error(`Storage bucket '${bucket}' issue: ${errorMessage}`);
      } else {
        console.error(`Storage upload error (${statusCode}):`, uploadError);
        toast.error(`Upload failed: ${errorMessage}`);
      }
      throw new Error(`Upload failed with status ${statusCode}: ${errorMessage}`);
    }
    
    if (!uploadData?.path) {
      const error = new Error('No upload path returned');
      toast.error(error.message);
      throw error;
    }

    // Get the public URL with proper handling for WebP
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);
    
    // Fix any double slashes in the URL (except after protocol)
    const fixedUrl = publicUrl.replace(/([^:])\/\//g, '$1/');
    
    // ALWAYS use object URLs directly for production environment
    // This avoids the 400 Bad Request errors with the render API
    const finalUrl = fixedUrl.includes('/storage/v1/render/image/') 
      ? fixedUrl.replace('/storage/v1/render/image/', '/storage/v1/object/') 
      : fixedUrl;
      
    console.log(`Successfully uploaded to ${finalUrl}`);
    
    try {
      await verifyUrlAccessibility(finalUrl);
    } catch (error) {
      console.warn("URL verification failed but upload succeeded:", error);
      // We'll still return the URL since the file was uploaded
    }
    
    // Update progress to complete
    if (onProgress) onProgress(100);
    
    return finalUrl;
  } catch (error) {
    // On error ensure progress is reset
    if (onProgress) onProgress(0);
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

export function sanitizeFilename(filename: string): string {
  // Remove path components
  const withoutPath = filename.split(/[\\/]/).pop() || filename;
  
  // Clean up problematic patterns
  const cleaned = withoutPath
    .replace(/[^\w\s.-]/g, '') // Remove special chars except dots, dashes, underscores
    .replace(/\s+/g, '-')      // Replace spaces with dashes
    .toLowerCase();            // Convert to lowercase

  return cleaned;
}

export function generateSafeFilename(originalName: string, collection = 'default'): string {
  const ext = path.extname(originalName);
  
  // Generate timestamp in a consistent format (YYYYMMDDHHMMSS)
  const timestamp = format(new Date(), "yyyyMMddHHmmss");
  
  // Generate a fixed-length random string (12 chars for more uniqueness)
  const randomString = crypto.randomBytes(6).toString('hex');
  
  // Construct final filename using collection-based format without separators
  return `${collection}${randomString}${timestamp}${ext}`;
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

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(cleanPath);

  const renderUrl = urlData.publicUrl.replace('/object/public', '/render/image/public');
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