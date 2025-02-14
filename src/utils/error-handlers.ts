import { PostgrestError } from '@supabase/supabase-js';

export function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Object &&
    'code' in error &&
    error.code === 'PGRST116'
  );
}

export function handleCollectionError(error: unknown): string {
  if (isNotFoundError(error)) {
    return 'Collection not found';
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}