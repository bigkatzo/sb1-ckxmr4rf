import { supabase } from './supabase';
import { toast } from 'react-toastify';
import path from 'path';
import { format } from 'date-fns';
import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';

export type StorageBucket = 'collection-images' | 'product-images' | 'site-assets' | 'profile-images';

export interface UploadResult {
  path: string;
  url: string;
}

interface UploadOptions {
  maxSizeMB?: number;
  cacheControl?: string;
  upsert?: boolean;
  webpHandling?: 'preserve' | 'optimize';
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
    
    // Step 6: Extract file extension to make format-specific decisions
    const fileExtension = path.split('.').pop()?.toLowerCase() || '';
    const isWebP = fileExtension === 'webp' || path.toLowerCase().includes('.webp');
    const isGif = fileExtension === 'gif' || path.toLowerCase().includes('.gif');
    const isSvg = fileExtension === 'svg' || path.toLowerCase().includes('.svg');
    const isJpgOrPng = /\.(jpe?g|png)$/i.test(path);
    
    // Step 7: Handle based on URL type and file format
    
    // WebP, GIF, and SVG files should ALWAYS use object URLs (not render URLs)
    // because they can have compatibility issues with the render endpoint
    if (isWebP || isGif || isSvg) {
      // If already has object URL format, return the fixed URL
      if (path.includes('/storage/v1/object/public/')) {
        // Ensure the URL is properly formatted with no double slashes
        return `${parsedUrl.protocol}//${parsedUrl.host}${path}`;
      }
      
      // If has render URL format, convert to object URL format
      if (path.includes('/storage/v1/render/image/public/')) {
        const objectPath = path.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
        return `${parsedUrl.protocol}//${parsedUrl.host}${objectPath}`;
      }
    }
    
    // Already a render URL - don't modify it unless it's WebP, GIF or SVG
    if (path.includes('/storage/v1/render/image/')) {
      if (isWebP || isGif || isSvg) {
        // Convert to object URL for better compatibility
        const objectPath = path.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
        return `${parsedUrl.protocol}//${parsedUrl.host}${objectPath}`;
      }
      return `${parsedUrl.protocol}//${parsedUrl.host}${path}${parsedUrl.search}`; // Leave other render URLs as-is
    }
    
    // Object URL - conditionally convert to render URL for supported formats
    if (path.includes('/storage/v1/object/public/')) {
      // WebP, GIF, and SVG should stay as object URLs
      if (isWebP || isGif || isSvg) {
        return `${parsedUrl.protocol}//${parsedUrl.host}${path}`;
      }
      
      // JPG/PNG formats work well with render endpoint
      if (isJpgOrPng) {
        // Convert to render URL with optimized parameters
        const renderPath = path.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
        
        // Add optimal parameters for rendering
        const params = new URLSearchParams(parsedUrl.search);
        if (!params.has('width')) params.append('width', '800');
        if (!params.has('quality')) params.append('quality', '80');
        params.append('format', 'original'); // Preserve original format
        
        // Build final URL
        return `${parsedUrl.protocol}//${parsedUrl.host}${renderPath}?${params.toString()}`;
      }
      
      // For other formats, keep as object URL
      return `${parsedUrl.protocol}//${parsedUrl.host}${path}`;
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
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
      console.warn('Warning: Generated image URL may not be publicly accessible:', {
        status: response.status,
        url
      });
    }
  } catch (error) {
    console.warn('Warning: Could not verify image URL accessibility:', error);
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
    webpHandling
  } = options;

  try {
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
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(cleanPath, fileToUpload, {
        cacheControl,
        contentType: fileToUpload.type,
        upsert,
        metadata
      });

    if (uploadError) {
      if (uploadError.message.includes('bucket') || (uploadError as any).statusCode === 400) {
        console.error(`Storage bucket '${bucket}' error:`, uploadError);
        toast.error(`Storage bucket '${bucket}' is not properly configured. Please contact support.`);
      } else {
        console.error('Storage upload error:', uploadError);
        toast.error(`Upload failed: ${uploadError.message}`);
      }
      throw uploadError;
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
    
    // If it's a WebP file, use object URL directly for compatibility
    if (isWebP) {
      console.log(`Using direct object URL for WebP: ${fixedUrl}`);
      return fixedUrl; // Return direct object URL for WebP
    }
    
    // For other formats, use our normal URL normalization
    const baseUrl = new URL(fixedUrl).origin;
    const bucketPath = bucket.replace(/^\/+|\/+$/g, '');
    const filePath = uploadData.path.replace(/^\/+|\/+$/g, '');
    const renderUrl = `${baseUrl}/storage/v1/render/image/public/${bucketPath}/${filePath}`;
    const finalUrl = normalizeStorageUrl(renderUrl);
    
    await verifyUrlAccessibility(finalUrl);
    
    return finalUrl;
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