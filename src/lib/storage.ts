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
  
  try {
    // Parse the URL to handle it properly
    const parsedUrl = new URL(url);
    
    // Ensure HTTPS
    parsedUrl.protocol = 'https:';
    
    // Always use render/image endpoint
    let path = parsedUrl.pathname;
    
    // If the path doesn't already use render/image, convert it
    if (!path.includes('/render/image/')) {
      path = path
        .replace('/storage/v1/object/', '/storage/v1/render/image/')
        .replace('/storage/v1/', '/storage/v1/render/image/');
    }
    
    // Clean up the path
    // 1. Remove any double slashes
    path = path.replace(/\/+/g, '/');
    // 2. Ensure proper structure: /storage/v1/render/image/public/{bucket}/{filename}
    if (!path.includes('/public/')) {
      path = path.replace(/\/([^/]+)\/([^/]+)$/, '/public/$1/$2');
    }
    
    // Reconstruct the URL without query parameters
    const normalizedUrl = `${parsedUrl.protocol}//${parsedUrl.host}${path}`;
    
    // Log the transformation
    console.log('URL normalization:', JSON.stringify({
      originalUrl: url,
      normalizedUrl,
      steps: {
        parsed: parsedUrl.toString(),
        pathNormalized: path,
        final: normalizedUrl
      }
    }, null, 2));
    
    return normalizedUrl;
  } catch (error) {
    console.error('Error normalizing URL:', error);
    // If URL parsing fails, fall back to regex-based normalization
    let normalizedUrl = url.replace(/^http:/, 'https:');
    normalizedUrl = normalizedUrl.replace(/[?#].*$/, '');
    normalizedUrl = normalizedUrl.replace('/storage/v1/object/', '/storage/v1/render/image/');
    normalizedUrl = normalizedUrl.replace(/\/+/g, '/');
    if (!normalizedUrl.includes('/public/')) {
      normalizedUrl = normalizedUrl.replace(/\/([^/]+)\/([^/]+)$/, '/public/$1/$2');
    }
    return normalizedUrl;
  }
}

// Sanitize filename to remove problematic characters
function sanitizeFileName(fileName: string): string {
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
  
  // Log the sanitization
  console.log('Filename sanitization:', JSON.stringify({
    input: fileName,
    cleaned,
    sanitized,
    steps: {
      removedPath: name,
      cleanedPatterns: cleaned,
      final: sanitized
    }
  }, null, 2));
  
  return sanitized;
}

// Generate a unique filename with timestamp and random string
function generateUniqueFileName(originalName: string): string {
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
  
  // Construct final filename
  const finalName = `${timestamp}-${randomString}-${sanitizedName}${extension}`;
  
  // Log the generation
  console.log('Filename generation:', JSON.stringify({
    originalName,
    steps: {
      extension,
      baseName,
      sanitizedName,
      timestamp,
      randomString,
      finalName
    }
  }, null, 2));
  
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

    // Construct the URL directly using the render/image endpoint
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);
    
    // Get the base URL from the public URL
    const baseUrl = new URL(publicUrl).origin;
    const renderUrl = `${baseUrl}/storage/v1/render/image/public/${bucket}/${uploadData.path}`;
    
    // Normalize the URL to ensure consistency
    const finalUrl = normalizeStorageUrl(renderUrl);
    
    // Verify the URL is accessible
    await verifyUrlAccessibility(finalUrl);
    
    console.log('Final URL:', JSON.stringify({
      uploadPath: uploadData.path,
      renderUrl,
      finalUrl,
      bucket
    }, null, 2));

    return finalUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
} 