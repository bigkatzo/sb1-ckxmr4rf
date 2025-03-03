import { supabase } from './supabase';
import { toast } from 'react-toastify';
import path from 'path';
import { format } from 'date-fns';
import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';

export type StorageBucket = 'collection-images' | 'product-images';

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
    path = path.replace(/\/+/g, '/');
    if (!path.includes('/public/')) {
      path = path.replace(/\/([^/]+)\/([^/]+)$/, '/public/$1/$2');
    }
    
    return `${parsedUrl.protocol}//${parsedUrl.host}${path}`;
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
  
  // Construct final filename
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
    cacheControl = '3600',
    upsert = false
  } = options;

  try {
    validateFile(file, maxSizeMB);
    const safeFileName = generateUniqueFileName(file.name);
    const cleanPath = safeFileName.replace(/^\/+|\/+$/g, '');

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(cleanPath, file, {
        cacheControl,
        contentType: file.type,
        upsert
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