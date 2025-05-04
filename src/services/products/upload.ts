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