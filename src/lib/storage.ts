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
  
  // First normalize the protocol and domain part
  let normalizedUrl = url
    .replace(/^http:/, 'https:') // Ensure HTTPS
    .replace(/^https:\/([^/])/, 'https://$1'); // Fix protocol slashes if missing

  // Split the URL into base and path parts
  const [base, ...pathParts] = normalizedUrl.split('/storage/');
  
  if (pathParts.length === 0) {
    // If there's no storage part, just clean up any multiple slashes
    return normalizedUrl.replace(/([^:])\/+/g, '$1/').replace(/\/+$/, '');
  }

  // Clean up the path part (after /storage/)
  const cleanPath = pathParts.join('/storage/')
    .split('/')
    .filter(Boolean) // Remove empty segments
    .join('/');

  // Reconstruct the URL
  return `${base}/storage/${cleanPath}`;
}

// Sanitize filename to remove problematic characters
function sanitizeFileName(fileName: string): string {
  // Remove any path traversal characters
  const name = fileName.replace(/^.*[/\\]/, '');
  
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

// Clean file path by removing any extra slashes
function cleanFilePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean) // Remove empty segments that cause double slashes
    .join('/');
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

    // Generate safe filename without any path
    const safeFileName = generateUniqueFileName(file.name);
    
    console.log('Attempting to upload file:', {
      fileName: safeFileName,
      fileType: file.type,
      fileSize: file.size,
      bucket
    });

    // Upload file - using the filename directly without any path manipulation
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(safeFileName, file, {
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

    console.log('File uploaded successfully:', uploadData.path);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    // Clean and normalize the URL
    const finalUrl = normalizeStorageUrl(publicUrl);
    
    // Log URL for debugging
    console.log('Generated public URL:', {
      original: publicUrl,
      final: finalUrl,
      path: uploadData.path
    });
    
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