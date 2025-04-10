/**
 * Global error handling utilities
 * Provides consistent error handling across the application
 */

// Severity levels for errors
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Error context with additional information
export interface ErrorContext {
  userId?: string;
  orderId?: string;
  productId?: string;
  component?: string;
  additionalData?: Record<string, any>;
}

// Structured error for consistent handling
export interface StructuredError {
  message: string;
  code?: string;
  severity: ErrorSeverity;
  timestamp: string;
  originalError?: Error;
  context?: ErrorContext;
}

/**
 * Transforms any error into a structured format
 */
export function formatError(
  error: unknown, 
  severity: ErrorSeverity = ErrorSeverity.ERROR,
  context?: ErrorContext
): StructuredError {
  const timestamp = new Date().toISOString();
  
  // Handle different error types
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as any).code,
      severity,
      timestamp,
      originalError: error,
      context
    };
  } else if (typeof error === 'string') {
    return {
      message: error,
      severity,
      timestamp,
      context
    };
  } else {
    // Handle unknown error types
    return {
      message: 'Unknown error occurred',
      severity,
      timestamp,
      originalError: error as any,
      context
    };
  }
}

/**
 * Logs errors to console in development and to monitoring service in production
 */
export function logError(
  error: unknown,
  severity: ErrorSeverity = ErrorSeverity.ERROR,
  context?: ErrorContext
): StructuredError {
  const structuredError = formatError(error, severity, context);
  
  // In development, log to console with appropriate formatting
  if (import.meta.env.DEV) {
    const logFn = 
      severity === ErrorSeverity.INFO ? console.info :
      severity === ErrorSeverity.WARNING ? console.warn :
      console.error;
    
    logFn(
      `[${severity.toUpperCase()}] ${structuredError.message}`,
      structuredError.context ? { context: structuredError.context } : '',
      structuredError.originalError || ''
    );
  } else {
    // In production, we could send to external monitoring service
    // For now, just log to console - in the future integrate with a service like Sentry
    console.error(`[${severity}]`, structuredError);
    
    // Future implementation:
    // sendToMonitoringService(structuredError);
  }
  
  return structuredError;
}

/**
 * Reports a user-facing error - logs it and optionally shows UI notification
 */
export function reportError(
  error: unknown,
  severity: ErrorSeverity = ErrorSeverity.ERROR,
  context?: ErrorContext,
  showToUser: boolean = true
): StructuredError {
  const structuredError = logError(error, severity, context);
  
  // Could integrate with a toast notification here if showToUser is true
  // Commented out until toast provider is properly set up
  /*
  if (showToUser) {
    const message = 
      severity === ErrorSeverity.CRITICAL 
        ? 'A critical error occurred. Please try again or contact support.' 
        : structuredError.message || 'An error occurred';
    
    // Use your UI notification library - for example:
    // toast.error(message);
  }
  */
  
  return structuredError;
}

/**
 * Helper function for building a useful error context
 */
export function createErrorContext(data: Partial<ErrorContext> = {}): ErrorContext {
  // Could auto-populate with any global context like current user
  return {
    ...data,
    // Additional global context can be added here
  };
}

/**
 * Handler for async operations that might fail
 * @example
 * const [data, error] = await safeAsync(fetchData());
 * if (error) { handleError(error); return; }
 * // Use data safely here
 */
export async function safeAsync<T>(
  promise: Promise<T>,
  errorContext?: ErrorContext
): Promise<[T | null, StructuredError | null]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    const structuredError = logError(error, ErrorSeverity.ERROR, errorContext);
    return [null, structuredError];
  }
} 