import { supabase } from '../../lib/supabase';
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

export async function uploadProductImages(files: File[]): Promise<string[]> {
  const uploadPromises = files.map(async (file) => {
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

      // Upload with minimal metadata and cache control
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(safeFileName, file, {
          cacheControl: '31536000', // 1 year cache
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      if (!uploadData?.path) {
        throw new Error('No upload path returned');
      }

      // Get public URL with transformation
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
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
      console.error('Product image upload error:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload image';
      toast.error(message);
      throw error;
    }
  });

  try {
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading product images:', error);
    throw new Error('Failed to upload one or more product images. Please try again.');
  }
}