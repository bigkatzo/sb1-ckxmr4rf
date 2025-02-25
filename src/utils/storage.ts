import { supabase } from '../lib/supabase';

export function normalizeStorageUrl(path: string): string {
  if (!path) return '';
  
  // If it's already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // Remove any leading slashes
  const normalizedPath = path.replace(/^\/+/, '');

  // Get the public URL for the file
  const { data: { publicUrl } } = supabase.storage
    .from('public')
    .getPublicUrl(normalizedPath);

  return publicUrl;
} 