import { Handler } from '@netlify/functions';

// Simplified webhook handler for testing
export const handler: Handler = async (event) => {
  // Log request for debugging
  console.log('Webhook received:', {
    method: event.httpMethod,
    headers: event.headers,
    body: event.body ? JSON.parse(event.body) : null
  });

  // Return a simple 200 response
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Webhook received successfully',
      status: 'ok'
    })
  };
}; 