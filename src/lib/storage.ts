import { supabase } from './supabase';
import { toast } from 'react-toastify';

export type StorageBucket = 'collection-images' | 'product-images';

interface UploadOptions {
  maxSizeMB?: number;
  cacheControl?: string;
  upsert?: boolean;
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

// Verify bucket exists and is accessible
async function verifyBucket(bucket: StorageBucket): Promise<void> {
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  
  if (bucketError) {
    console.error('Failed to list buckets:', bucketError);
    toast.error('Storage system not accessible');
    throw bucketError;
  }

  const bucketExists = buckets.some(b => b.name === bucket);
  if (!bucketExists) {
    const error = new Error(`Storage not properly configured: ${bucket} bucket missing`);
    console.error(error);
    toast.error(error.message);
    throw error;
  }
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
    // Validate file and bucket
    validateFile(file, maxSizeMB);
    await verifyBucket(bucket);

    // Generate safe filename
    const safeFileName = generateUniqueFileName(file.name);
    
    console.log('Attempting to upload file:', {
      fileName: safeFileName,
      fileType: file.type,
      fileSize: file.size,
      bucket
    });

    // Upload file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(safeFileName, file, {
        cacheControl,
        contentType: file.type,
        upsert
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      toast.error(`Upload failed: ${uploadError.message}`);
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

    // Ensure HTTPS
    const finalUrl = publicUrl.replace(/^http:/, 'https:');
    
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