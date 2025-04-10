/**
 * Error handling middleware for Netlify Functions
 * Provides consistent error responses and logging
 */

/**
 * Wraps a Netlify function handler with error handling middleware
 * @param {Function} handler - Original Netlify function handler
 * @returns {Function} - Enhanced handler with error handling
 */
function withErrorHandling(handler) {
  return async (event, context) => {
    try {
      // Call the original handler
      const result = await handler(event, context);
      return result;
    } catch (error) {
      // Log the error with contextual information
      console.error('Function error:', {
        path: event.path,
        httpMethod: event.httpMethod,
        functionName: context.functionName,
        error: error.message,
        stack: error.stack
      });
      
      // Check if it's a known error type with status code
      if (error.statusCode) {
        return {
          statusCode: error.statusCode,
          body: JSON.stringify({
            error: error.message,
            code: error.code || 'FUNCTION_ERROR'
          })
        };
      }
      
      // Default to 500 for unknown errors
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Internal Server Error',
          code: 'INTERNAL_SERVER_ERROR',
          // Only include detailed error in development
          ...(process.env.NODE_ENV !== 'production' && { 
            detail: error.message,
            stack: error.stack
          })
        })
      };
    }
  };
}

/**
 * Create a standard error response
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @returns {Object} - Netlify function response
 */
function createErrorResponse(statusCode, message, code) {
  return {
    statusCode,
    body: JSON.stringify({
      error: message,
      code
    })
  };
}

/**
 * Utility to create common error responses
 */
const errors = {
  badRequest: (message = 'Bad Request', code = 'BAD_REQUEST') => 
    createErrorResponse(400, message, code),
    
  unauthorized: (message = 'Unauthorized', code = 'UNAUTHORIZED') => 
    createErrorResponse(401, message, code),
    
  forbidden: (message = 'Forbidden', code = 'FORBIDDEN') => 
    createErrorResponse(403, message, code),
    
  notFound: (message = 'Not Found', code = 'NOT_FOUND') => 
    createErrorResponse(404, message, code),
    
  methodNotAllowed: (message = 'Method Not Allowed', code = 'METHOD_NOT_ALLOWED') => 
    createErrorResponse(405, message, code),
    
  conflict: (message = 'Conflict', code = 'CONFLICT') => 
    createErrorResponse(409, message, code),
    
  serverError: (message = 'Internal Server Error', code = 'INTERNAL_SERVER_ERROR') => 
    createErrorResponse(500, message, code)
};

module.exports = {
  withErrorHandling,
  createErrorResponse,
  errors
}; 