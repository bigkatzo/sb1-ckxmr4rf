import { supabase } from './supabase';
import { toast } from 'react-toastify';
import path from 'path';
import { format } from 'date-fns';
import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';

export type StorageBucket = 'collection-images' | 'product-images' | 'site-assets';

export interface UploadResult {
  path: string;
  url: string;
}

interface UploadOptions {
  maxSizeMB?: number;
  cacheControl?: string;
  upsert?: boolean;
}

// Normalize storage URLs to ensure consistent format
export function normalizeStorageUrl(url: string): string {
  if (!url) return '';
  
  try {
    // First, check if this is a problematic URL with special characters
    const hasSpecialChars = /[\(\) ]/.test(url);
    const hasWebpOrDash = url.includes('.webp') || url.includes('-d');
    
    // For problematic URLs, handle special characters properly
    if (hasSpecialChars || hasWebpOrDash) {
      try {
        const parsedUrl = new URL(url);
        
        // Get the path parts to identify the filename
        const pathParts = parsedUrl.pathname.split('/');
        const fileNameIndex = pathParts.length - 1;
        const originalFilename = pathParts[fileNameIndex];
        
        // Handle special characters in the filename
        try {
          // First try to decode in case it's already partially encoded
          const decodedFilename = decodeURIComponent(originalFilename);
          
          // Re-encode properly, preserving most special characters but handling problematic ones
          const encodedFilename = encodeURIComponent(decodedFilename)
            .replace(/%20/g, '-')   // Convert spaces to hyphens
            .replace(/%28/g, '%28') // Keep parentheses but properly encoded
            .replace(/%29/g, '%29') // Keep parentheses but properly encoded
            .replace(/%2F/g, '-');  // Replace slashes with hyphens
          
          // Replace the filename part in the path
          pathParts[fileNameIndex] = encodedFilename;
          parsedUrl.pathname = pathParts.join('/');
          
          // For these problematic files, always use object URL
          if (parsedUrl.pathname.includes('/storage/v1/render/image/public/')) {
            parsedUrl.pathname = parsedUrl.pathname.replace(
              '/storage/v1/render/image/public/',
              '/storage/v1/object/public/'
            );
            // Remove query parameters for object URLs
            parsedUrl.search = '';
          }
          
          return parsedUrl.toString();
        } catch (e) {
          // If encoding fails, fall back to original handling
          console.warn('Error handling special characters in URL:', e);
        }
      } catch (e) {
        // If URL parsing fails, try basic string operations
        if (url.includes('/storage/v1/render/image/public/') && (hasSpecialChars || hasWebpOrDash)) {
          // Convert render URLs with special chars to object URLs
          return url.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/').split('?')[0];
        }
      }
    }
    
    // Parse the URL to handle it properly
    const parsedUrl = new URL(url);
    
    // Ensure HTTPS
    parsedUrl.protocol = 'https:';
    
    // Get the path
    let path = parsedUrl.pathname;
    
    // If it's already a render/image URL, don't modify it
    if (path.includes('/storage/v1/render/image/')) {
      // Unless it has special characters or is WebP, in which case convert to object URL
      if (hasSpecialChars || hasWebpOrDash) {
        path = path.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
        parsedUrl.pathname = path;
        parsedUrl.search = ''; // Remove query params
        return parsedUrl.toString();
      }
      return url;
    }
    
    // Always convert object URLs to render URLs (more aggressive approach)
    if (path.includes('/storage/v1/object/public/')) {
      // Skip conversion for files with special characters or WebP
      if (hasSpecialChars || hasWebpOrDash) {
        return url;
      }
      
      // Check if this is a file format that works well with the render endpoint
      const isJpgOrPng = /\.(jpe?g|png)$/i.test(path);
      
      // ONLY use render endpoint for JPG and PNG formats which are better supported
      if (isJpgOrPng) {
        // Convert to render URL for images with specific parameters for compatibility
        path = path.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
        
        // Add required parameters for better compatibility
        const params = new URLSearchParams(parsedUrl.search);
        if (!params.has('width')) params.append('width', '800');
        if (!params.has('quality')) params.append('quality', '80');
        
        // Try to avoid format conversion which can cause issues
        params.append('format', 'original');
        
        // Preserve query parameters if they exist
        const finalUrl = `${parsedUrl.protocol}//${parsedUrl.host}${path}?${params.toString()}`;
        
        // Log conversion for debugging
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('Normalized storage URL:', { original: url, normalized: finalUrl });
        }
        
        return finalUrl;
      } else {
        // For other formats (webp, gif, etc) just use the object URL which works more reliably
        return url;
      }
    }
    
    // For other URLs, return as is
    return url;
  } catch (error) {
    console.error('Error normalizing URL:', error);
    
    // EMERGENCY FALLBACK: If URL parsing fails but contains WebP or special characters, ensure it uses object URL
    if (typeof url === 'string') {
      if ((url.includes('.webp') || url.includes('-d') || /[\(\) ]/.test(url)) && 
          url.includes('/storage/v1/render/image/public/')) {
        return url.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/').split('?')[0];
      }
      
      // If it looks like a Supabase storage URL, try a simple string replace
      // But only for jpg/png formats without special characters
      if (url.includes('/storage/v1/object/public/')) {
        if (/\.(jpe?g|png)$/i.test(url) && !/[\(\) ]/.test(url)) {
          // Only convert JPG/PNG, and include params
          const convertedUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
          return `${convertedUrl}?width=800&quality=80&format=original`;
        }
        // For other formats, leave as is
        return url;
      }
    }
    
    // Otherwise return the original URL
    return url;
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
  // Allow alphanumeric characters, dots, hyphens and underscores
  const sanitized = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-') // Replace non-alphanumeric with single hyphen (excluding dots, hyphens, underscores)
    .replace(/-+/g, '-')          // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '')      // Remove leading/trailing hyphens
    .replace(/^\.+|\.+$/g, '');   // Remove leading/trailing dots
  
  return sanitized;
}

// Generate a unique filename with timestamp and random string
export function generateUniqueFileName(originalName: string): string {
  // Extract extension safely
  const extension = (originalName.match(/\.[^/.]+$/)?.[0] || '').toLowerCase();
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  
  // Generate timestamp in a consistent format (YYYYMMDDHHMMSS)
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/[T.]/g, '')
    .slice(0, 14);
  
  // Generate a fixed-length random string (8 chars)
  const randomString = Math.random().toString(36).substring(2, 10);
  
  // Clean the base name
  const sanitizedName = sanitizeFileName(baseName);
  
  // Construct final filename - place sanitized name at the end to make it readable but still have unique prefix
  const finalName = `${timestamp}-${randomString}-${sanitizedName}${extension}`;
  
  return finalName;
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
    upsert = false
  } = options;

  try {
    validateFile(file, maxSizeMB);
    const safeFileName = generateUniqueFileName(file.name);
    const cleanPath = safeFileName.replace(/^\/+|\/+$/g, '');

    // Add metadata to track image association and upload time
    const metadata = {
      contentType: file.type,
      cacheControl,
      // Add tracking metadata
      lastAccessed: new Date().toISOString(),
      uploadedAt: new Date().toISOString(),
      associatedEntity: bucket === 'collection-images' 
        ? 'collection' 
        : bucket === 'product-images' 
          ? 'product' 
          : 'site',
      originalFilename: file.name // Store original filename for reference
    };

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(cleanPath, file, {
        cacheControl,
        contentType: file.type,
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

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);
    
    const baseUrl = new URL(publicUrl).origin;
    const renderUrl = `${baseUrl}/storage/v1/render/image/public/${bucket}/${uploadData.path}`;
    const finalUrl = normalizeStorageUrl(renderUrl);
    
    await verifyUrlAccessibility(finalUrl);
    
    return finalUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

// Improved URL normalization function
export function normalizeUrl(url: string): string {
  if (!url) return '';
  
  try {
    // Parse the URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      // If URL parsing fails, return the original
      return url;
    }

    // Get the path and ensure it's properly encoded
    const pathParts = parsedUrl.pathname.split('/');
    
    // Find the filename (last part of the path)
    const fileNameIndex = pathParts.length - 1;
    
    // Only process if the URL appears to be a Supabase storage URL
    if (parsedUrl.pathname.includes('/storage/v1/')) {
      // Properly encode the filename part
      const originalFilename = pathParts[fileNameIndex];
      
      // Decode first in case it's already partially encoded (avoid double encoding)
      let decodedFilename;
      try {
        decodedFilename = decodeURIComponent(originalFilename);
      } catch (e) {
        decodedFilename = originalFilename;
      }
      
      // Properly encode all characters that might cause issues
      // This uses encodeURIComponent which handles all special characters including parentheses
      const encodedFilename = encodeURIComponent(decodedFilename)
        // Firefox and some browsers don't handle certain encodings well, so convert back some safe characters
        .replace(/%20/g, '-') // Convert encoded spaces to hyphens for safer URLs
        .replace(/%2C/g, ',') // Keep commas readable
        .replace(/%2F/g, '-') // Convert slashes to hyphens for safety
        .replace(/%28/g, '') // Remove opening parentheses completely
        .replace(/%29/g, '') // Remove closing parentheses completely;
      
      // Replace the filename in the path
      pathParts[fileNameIndex] = encodedFilename;
      
      // Reconstruct the path
      const newPathname = pathParts.join('/');
      
      // Update the URL
      parsedUrl.pathname = newPathname;
    }
    
    // Handle query parameters
    const newUrl = parsedUrl.toString();
    
    // Determine if we need to convert between render and object URLs
    if (newUrl.includes('/storage/v1/object/public/')) {
      const isJpgOrPng = /\.(jpe?g|png)$/i.test(newUrl.toLowerCase());
      const isWebpOrProblematic = /\.(webp)$/i.test(newUrl.toLowerCase()) || 
                                  newUrl.includes('-d') || 
                                  newUrl.includes('(') || 
                                  newUrl.includes(')') ||
                                  newUrl.includes(' ');
      
      // For JPG and PNG, use render endpoint unless they have problematic characters
      if (isJpgOrPng && !isWebpOrProblematic) {
        const renderUrl = newUrl.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
        return `${renderUrl}${renderUrl.includes('?') ? '&' : '?'}width=800&quality=80&format=original`;
      }
      
      // Otherwise keep as object URL
      return newUrl;
    } else if (newUrl.includes('/storage/v1/render/image/public/')) {
      const isWebpOrProblematic = /\.(webp)$/i.test(newUrl.toLowerCase()) || 
                                  newUrl.includes('-d') || 
                                  newUrl.includes('(') || 
                                  newUrl.includes(')') ||
                                  newUrl.includes(' ');
      
      // For problematic files, convert render URLs to object URLs
      if (isWebpOrProblematic) {
        return newUrl.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/').split('?')[0];
      }
      
      // Otherwise ensure render URL has proper parameters
      if (!newUrl.includes('width=') || !newUrl.includes('quality=')) {
        return `${newUrl}${newUrl.includes('?') ? '&' : '?'}width=800&quality=80&format=original`;
      }
      
      return newUrl;
    }
    
    return newUrl;
  } catch (error) {
    console.error('URL normalization error:', error);
    return url; // Return original if anything fails
  }
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

export function generateSafeFilename(originalName: string): string {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const sanitizedName = sanitizeFilename(baseName);
  
  // Add timestamp and random string
  const timestamp = format(new Date(), "yyyyMMddHHmmss");
  const randomString = crypto.randomBytes(4).toString('hex');
  
  return `${timestamp}-${randomString}-${sanitizedName}${ext}`;
}

export async function uploadFile(
  supabase: SupabaseClient,
  file: File,
  bucket: string
): Promise<UploadResult> {
  const safeFileName = generateSafeFilename(file.name);
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