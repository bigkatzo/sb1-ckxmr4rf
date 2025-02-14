import { supabase } from '../../lib/supabase';
import { withRetry } from '../../lib/supabase';

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

export async function uploadCollectionImage(file: File): Promise<string> {
  try {
    // Validate file
    if (!file.type.startsWith('image/')) {
      throw new Error('Invalid file type. Only images are allowed.');
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum size is 5MB.');
    }

    // Generate safe filename with better sanitization
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const sanitizedName = sanitizeFileName(file.name);
    const safeFileName = `${timestamp}-${randomString}-${sanitizedName}`;
    
    // Upload with retries - include cache control
    const { data: uploadData, error: uploadError } = await withRetry(() =>
      supabase.storage
        .from('collection-images')
        .upload(safeFileName, file, {
          cacheControl: '31536000', // 1 year cache
          contentType: file.type,
          upsert: false
        })
    );

    if (uploadError) throw uploadError;
    if (!uploadData?.path) throw new Error('No upload path returned');

    // Get public URL with transformation options
    const { data: { publicUrl } } = supabase.storage
      .from('collection-images')
      .getPublicUrl(uploadData.path, {
        transform: {
          quality: 80,
          format: 'webp'
        }
      });

    // Ensure the URL uses HTTPS
    const finalUrl = publicUrl.replace(/^http:/, 'https:');
    
    return finalUrl;
  } catch (error) {
    console.error('Collection image upload error:', error);
    throw error instanceof Error ? error : new Error('Failed to upload collection image');
  }
}