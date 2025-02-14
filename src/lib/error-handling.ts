import { PostgrestError } from '@supabase/supabase-js';
import { isSupabaseError } from './type-guards';

export function handleError(error: unknown): string {
  if (isSupabaseError(error)) {
    // Handle specific Postgres error codes
    switch (error.code) {
      case 'PGRST116': // No rows returned
        return 'No records found';
      case '22P02': // Invalid text representation
        return 'Invalid identifier format';
      case '23503': // Foreign key violation
        return 'Referenced record does not exist';
      case '23505': // Unique violation
        return 'A record with this identifier already exists';
      case '42P01': // Undefined table
        return 'Database table not found';
      case '42703': // Undefined column
        return 'Invalid field name';
      default:
        return error.message;
    }
  }
  
  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch')) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }
    return error.message;
  }
  
  return 'An unexpected error occurred';
}

export function handleCollectionError(error: unknown): string {
  if (isSupabaseError(error)) {
    if (error.code === 'PGRST116') {
      return 'Collection not found';
    }
    return handleError(error);
  }
  return 'Unable to load collection';
}

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}