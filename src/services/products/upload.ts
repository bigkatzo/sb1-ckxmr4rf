import { uploadImage } from '../../lib/storage';
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

export async function uploadProductImage(file: File): Promise<string> {
  return uploadImage(file, 'product-images');
}

export async function uploadProductImages(files: File[]): Promise<string[]> {
  return Promise.all(files.map(file => uploadProductImage(file)));
}