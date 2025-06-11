import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import type { BaseAccessType } from '../../types/collections';

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

export type AccessType = 'view' | 'edit';

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
  userId: string,
  accessType: BaseAccessType = 'view'
): Promise<boolean> {
  try {
    // First check if user is the owner
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('user_id')
      .eq('id', collectionId)
      .single();

    if (collectionError) throw collectionError;
    if (collection.user_id === userId) return true;

    // If not owner, check collection_access
    const { data: accessData, error: accessError } = await supabase
      .from('collection_access')
      .select('access_type')
      .eq('collection_id', collectionId)
      .eq('user_id', userId)
      .single();

    if (accessError) return false;

    // For view access, either view or edit permission is sufficient
    if (accessType === 'view') {
      return ['view', 'edit'].includes(accessData.access_type);
    }

    // For edit access, must have edit permission
    return accessData.access_type === 'edit';
  } catch (error) {
    console.error('Error verifying collection access:', error);
    return false;
  }
}