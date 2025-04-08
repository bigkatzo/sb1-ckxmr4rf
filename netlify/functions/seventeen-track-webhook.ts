import { Handler } from '@netlify/functions';

// Ultra-minimal webhook handler - only logs and acknowledges
export const handler: Handler = async (event) => {
  try {
    // Log minimal information about the request
    console.log('Webhook received:', {
      method: event.httpMethod,
      path: event.path
    });

    // Always return success to acknowledge receipt
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook acknowledged',
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    // Even if logging fails, still acknowledge
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook received'
      })
    };
  }
}; 