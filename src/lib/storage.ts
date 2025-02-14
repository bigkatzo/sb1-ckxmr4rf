import { supabase } from './supabase';
import { toast } from 'react-toastify';

export type StorageBucket = 'collection-images' | 'product-images';

interface UploadOptions {
  maxSizeMB?: number;
  cacheControl?: string;
  upsert?: boolean;
}

// Normalize storage URLs to ensure consistent format
export function normalizeStorageUrl(url: string): string {
  if (!url) return '';
  
  // Ensure HTTPS
  let normalizedUrl = url.replace(/^http:/, 'https:');
  
  // Remove double slashes (except after protocol)
  normalizedUrl = normalizedUrl.replace(/(?<!:)\/+/g, '/');
  
  return normalizedUrl;
}

// Sanitize filename to remove problematic characters
function sanitizeFileName(fileName: string): string {
  // Remove any path traversal characters and leading/trailing slashes
  const name = fileName.replace(/^.*[/\\]/, '').replace(/^\/+|\/+$/g, '');
  
  // Remove any non-alphanumeric characters except for common extensions
  const baseName = name.replace(/\.[^/.]+$/, '');
  const extension = name.match(/\.[^/.]+$/)?.[0] || '';
  
  // Replace spaces and special chars with hyphens, collapse multiple hyphens
  const sanitizedBase = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
    
  return `${sanitizedBase}${extension.toLowerCase()}`;
}

// Generate a unique filename with timestamp and random string
function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const sanitizedName = sanitizeFileName(originalName);
  return `${timestamp}-${randomString}-${sanitizedName}`;
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
    cacheControl = '3600',
    upsert = false
  } = options;

  try {
    // Validate file
    validateFile(file, maxSizeMB);

    // Generate safe filename
    const safeFileName = generateUniqueFileName(file.name);
    
    // Ensure clean path construction - no leading/trailing slashes
    const cleanPath = safeFileName.replace(/^\/+|\/+$/g, '');
    
    console.log('Upload details:', JSON.stringify({
      originalFileName: file.name,
      safeFileName,
      cleanPath,
      bucket
    }, null, 2));

    // Upload file with clean path
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(cleanPath, file, {
        cacheControl,
        contentType: file.type,
        upsert
      });

    if (uploadError) {
      // If bucket doesn't exist or isn't accessible
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

    console.log('Upload response:', JSON.stringify({
      uploadDataPath: uploadData.path,
      bucket
    }, null, 2));

    // Clean the path before getting public URL - ensure no double slashes
    const cleanUploadPath = uploadData.path.replace(/^\/+|\/+$/g, '');

    // Get public URL - construct it carefully
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(cleanUploadPath);

    console.log('URL generation steps:', JSON.stringify({
      uploadPath: uploadData.path,
      cleanUploadPath,
      rawPublicUrl: publicUrl,
      bucketPath: `${bucket}/${cleanUploadPath}`
    }, null, 2));

    // Function to check for unwanted double slashes (excluding protocol)
    const hasUnwantedDoubleSlash = (url: string) => {
      // Split URL into protocol and rest
      const [protocol, ...rest] = url.split('://');
      // Check for double slashes in the rest of the URL
      return rest.join('://').includes('//');
    };

    // Normalize the URL
    let finalUrl = publicUrl;
    
    // First ensure the bucket path is correct (no double slashes)
    const bucketPathPattern = new RegExp(`/${bucket}//`);
    if (bucketPathPattern.test(finalUrl)) {
      finalUrl = finalUrl.replace(bucketPathPattern, `/${bucket}/`);
    }
    
    // Then normalize any remaining double slashes and ensure HTTPS
    finalUrl = finalUrl
      .replace(/([^:]\/)\/+/g, '$1')  // Replace multiple slashes with single slash, except after colon
      .replace(/^http:/, 'https:');    // Ensure HTTPS
    
    console.log('Final URL processing:', JSON.stringify({
      originalUrl: publicUrl,
      normalizedUrl: finalUrl,
      hasUnwantedDoubleSlash: hasUnwantedDoubleSlash(finalUrl),
      pathParts: finalUrl.split('/').filter(Boolean)
    }, null, 2));
    
    // Double-check if we still have unwanted double slashes
    if (hasUnwantedDoubleSlash(finalUrl)) {
      console.warn('Warning: Unwanted double slash detected in final URL:', finalUrl);
      
      // Last resort fix - manually construct the URL
      const urlParts = finalUrl.split('/').filter(Boolean);
      const protocol = urlParts[0].replace(':', '');
      const domain = urlParts[1];
      const path = urlParts.slice(2).join('/');
      finalUrl = `${protocol}://${domain}/${path}`;
      
      console.log('URL reconstruction:', JSON.stringify({
        protocol,
        domain,
        path,
        finalUrl
      }, null, 2));
    }
    
    // Verify accessibility
    await verifyUrlAccessibility(finalUrl);
    
    return finalUrl;
  } catch (error) {
    console.error(`Image upload error (${bucket}):`, error);
    const message = error instanceof Error ? error.message : 'Failed to upload image';
    toast.error(message);
    throw error instanceof Error ? error : new Error(message);
  }
} 