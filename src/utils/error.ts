interface PostgrestError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

export function handleError(error: unknown): string {
  if (!error) return 'An unknown error occurred';

  // Handle Postgres/Supabase errors
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const pgError = error as PostgrestError;
    
    // Return user-friendly error messages for common error codes
    switch (pgError.code) {
      case '23505': // unique_violation
        return 'This record already exists';
      case '23503': // foreign_key_violation
        return 'This operation would break existing relationships';
      case '42P01': // undefined_table
        return 'System configuration error';
      case '42501': // insufficient_privilege
        return 'You do not have permission to perform this action';
      default:
        return pgError.message || pgError.details || 'Database error occurred';
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Fallback
  return 'An unexpected error occurred';
} 