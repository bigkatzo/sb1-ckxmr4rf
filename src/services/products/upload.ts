import { uploadImage } from '../../lib/storage';
import { toast } from 'react-toastify';

export async function uploadProductImage(file: File): Promise<string> {
  return uploadImage(file, 'product-images');
}

export async function uploadProductImages(files: File[]): Promise<string[]> {
  return Promise.all(files.map(file => uploadProductImage(file)));
}