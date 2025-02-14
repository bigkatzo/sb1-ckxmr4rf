import { uploadImage } from '../../lib/storage';
import { toast } from 'react-toastify';

export async function uploadCollectionImage(file: File): Promise<string> {
  return uploadImage(file, 'collection-images');
}