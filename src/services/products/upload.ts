import { uploadImage } from '../../lib/storage';

export async function uploadProductImage(file: File): Promise<string> {
  // Special handling for WebP files
  const isWebP = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp');
  
  if (isWebP) {
    console.log(`WebP file detected: ${file.name} (${file.size} bytes). Using direct upload path.`);
  }
  
  return uploadImage(file, 'product-images', {
    // Pass special flag for WebP to ensure it's handled correctly
    webpHandling: isWebP ? 'preserve' : undefined
  });
}

export async function uploadProductImages(files: File[]): Promise<string[]> {
  return Promise.all(files.map(file => uploadProductImage(file)));
}

export async function uploadDesignFile(file: File): Promise<string> {
  // Special handling for SVG files
  const isSVG = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  
  if (isSVG) {
    console.log(`SVG file detected: ${file.name} (${file.size} bytes). Using direct upload path.`);
  }
  
  // Use a different bucket for design files
  return uploadImage(file, 'product-design-files', {
    // Pass special flag for SVG to ensure it's handled correctly
    webpHandling: 'preserve', // Preserve original file format for design files
    maxSizeMB: 10 // Allow larger file size for design files (10MB)
  });
}

export async function uploadDesignFiles(files: File[]): Promise<string[]> {
  return Promise.all(files.map(file => uploadDesignFile(file)));
}