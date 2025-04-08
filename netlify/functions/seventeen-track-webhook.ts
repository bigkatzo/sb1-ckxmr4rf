import { Handler } from '@netlify/functions';

// Minimal webhook handler with payload logging
export const handler: Handler = async (event) => {
  try {
    // Log request info and headers
    console.log('Webhook received:', {
      method: event.httpMethod,
      path: event.path
    });

    // Try to parse and log the webhook body
    let payload: any = null;
    try {
      if (event.body) {
        payload = JSON.parse(event.body);
        console.log('Webhook payload:', {
          event: payload?.event,
          trackingNumber: payload?.data?.number,
          status: payload?.data?.track_info?.latest_status?.status
        });
      }
    } catch (error) {
      console.log('Error parsing webhook body (continuing anyway):', error);
    }

    // Always return success to acknowledge receipt
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook acknowledged',
        received: !!payload,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    // Even if everything fails, still acknowledge
    console.log('Unexpected error in webhook handler:', error);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Webhook received',
        error: 'Internal error occurred but webhook was received'
      })
    };
  }
}; 