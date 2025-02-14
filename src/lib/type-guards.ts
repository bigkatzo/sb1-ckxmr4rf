interface SupabaseError {
  message: string;
  details: string;
  hint?: string;
  code?: string;
}

export function isSupabaseError(error: unknown): error is SupabaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'details' in error
  );
}