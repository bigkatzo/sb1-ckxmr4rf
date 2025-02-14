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
  
  // Remove query params and hash fragments
  normalizedUrl = normalizedUrl.replace(/[?#].*$/, '');
  
  // Remove double slashes (except after protocol)
  // First split by protocol to preserve the double slashes there
  const [protocol, ...rest] = normalizedUrl.split('://');
  if (rest.length > 0) {
    // Join the rest and replace double slashes
    const path = rest.join('://').replace(/\/+/g, '/');
    normalizedUrl = `${protocol}://${path}`;
  }
  
  // Log the URL transformation
  console.log('URL normalization:', JSON.stringify({
    originalUrl: url,
    normalizedUrl,
    steps: {
      ensureHttps: url.replace(/^http:/, 'https:'),
      removeParams: url.replace(/[?#].*$/, ''),
      removeDoubleSlashes: normalizedUrl
    }
  }, null, 2));
  
  return normalizedUrl;
}

// Sanitize filename to remove problematic characters
function sanitizeFileName(fileName: string): string {
  // Remove any path traversal characters
  const name = fileName.replace(/^.*[/\\]/, '');
  
  // Convert to lowercase and remove non-alphanumeric characters
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-')          // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
  
  // Log the sanitization
  console.log('Filename sanitization:', JSON.stringify({
    input: fileName,
    removedPath: name,
    sanitized,
    steps: {
      lowercase: name.toLowerCase(),
      replaceNonAlphanumeric: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      removeMultipleHyphens: sanitized
    }
  }, null, 2));
  
  return sanitized;
}

// Generate a unique filename with timestamp and random string
function generateUniqueFileName(originalName: string): string {
  // Extract extension
  const extension = originalName.match(/\.[^/.]+$/)?.[0] || '';
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  
  // Generate timestamp in a consistent format (YYYYMMDDHHMMSS)
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/[T.]/g, '')
    .slice(0, 14);
  
  // Generate a fixed-length random string
  const randomString = Math.random().toString(36).substring(2, 10);
  
  // Clean the base name
  const sanitizedName = sanitizeFileName(baseName);
  
  // Log the filename generation
  console.log('Filename generation:', JSON.stringify({
    originalName,
    baseName,
    extension,
    timestamp,
    randomString,
    sanitizedName,
    finalName: `${timestamp}-${randomString}-${sanitizedName}${extension.toLowerCase()}`
  }, null, 2));
  
  return `${timestamp}-${randomString}-${sanitizedName}${extension.toLowerCase()}`;
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

    // Get public URL - construct it carefully
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    // Normalize the URL to ensure consistency
    const finalUrl = normalizeStorageUrl(publicUrl);
    
    console.log('Final URL:', JSON.stringify({
      originalUrl: publicUrl,
      normalizedUrl: finalUrl,
      path: uploadData.path,
      bucket
    }, null, 2));

    return finalUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
} 