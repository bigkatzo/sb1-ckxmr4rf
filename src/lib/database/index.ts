import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export async function withTransaction<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    if (isPostgrestError(error)) {
      throw new DatabaseError(
        getErrorMessage(error),
        error.code,
        error.details
      );
    }
    throw error instanceof Error 
      ? error 
      : new DatabaseError('Unknown database error');
  }
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'details' in error
  );
}

function getErrorMessage(error: PostgrestError): string {
  switch (error.code) {
    case '23505': return 'A record with this identifier already exists';
    case '23503': return 'Referenced record does not exist';
    case '42P01': return 'Table does not exist';
    case '42703': return 'Column does not exist';
    case 'PGRST116': return 'Record not found';
    case '23514': return 'Check constraint violation';
    default: return error.message;
  }
}

export async function verifyOwnership(
  table: string,
  id: string,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error(`Ownership verification failed for ${table}:`, error);
    return false;
  }
}

export async function verifyCollectionAccess(
  collectionId: string,
  userId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('id')
      .eq('id', collectionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Collection access verification failed:', error);
    return false;
  }
}