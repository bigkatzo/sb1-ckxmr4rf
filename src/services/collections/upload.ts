import { supabase } from '../../lib/supabase';
import { withRetry } from '../../lib/supabase';
import { toast } from 'react-toastify';

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
      const error = new Error('Invalid file type. Only images are allowed.');
      toast.error(error.message);
      throw error;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      const error = new Error('File size too large. Maximum size is 5MB.');
      toast.error(error.message);
      throw error;
    }

    // Generate safe filename with better sanitization
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const sanitizedName = sanitizeFileName(file.name);
    const safeFileName = `${timestamp}-${randomString}-${sanitizedName}`;
    
    console.log('Attempting to upload file:', {
      fileName: safeFileName,
      fileType: file.type,
      fileSize: file.size
    });

    // Upload with retries - include cache control
    const { data: uploadData, error: uploadError } = await withRetry(() =>
      supabase.storage
        .from('collection-images')
        .upload(safeFileName, file, {
          cacheControl: '3600', // Reduced to 1 hour for testing
          contentType: file.type,
          upsert: false
        })
    );

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

    // Get public URL without transformation options since they're not supported in free tier
    const { data: { publicUrl } } = supabase.storage
      .from('collection-images')
      .getPublicUrl(uploadData.path);

    // Ensure the URL uses HTTPS
    const finalUrl = publicUrl.replace(/^http:/, 'https:');
    console.log('Generated public URL:', finalUrl);
    
    return finalUrl;
  } catch (error) {
    console.error('Collection image upload error:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload collection image';
    toast.error(message);
    throw error instanceof Error ? error : new Error(message);
  }
}