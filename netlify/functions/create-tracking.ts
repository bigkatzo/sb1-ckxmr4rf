import { Handler } from '@netlify/functions';

interface CreateTrackingRequest {
  tracking_number: string;
  tracking_provider: string;
  order_id: string;
  postal_code?: string;
  destination_country?: string;
}

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const trackshipApiKey = process.env.TRACKSHIP_API_KEY;
    const appName = process.env.TRACKSHIP_APP_NAME;

    if (!trackshipApiKey || !appName) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'TrackShip configuration is missing' }),
      };
    }

    const body = JSON.parse(event.body || '{}') as CreateTrackingRequest;
    
    // Validate required fields
    if (!body.tracking_number || !body.tracking_provider || !body.order_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields: tracking_number, tracking_provider, and order_id are required' 
        }),
      };
    }

    const response = await fetch('https://api.trackship.com/v1/shipment/create/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'trackship-api-key': trackshipApiKey,
        'app-name': appName,
      },
      body: JSON.stringify({
        tracking_number: body.tracking_number,
        tracking_provider: body.tracking_provider,
        order_id: body.order_id,
        postal_code: body.postal_code,
        destination_country: body.destination_country,
      }),
    });

    const data = await response.json();

    if (data.status === 'error') {
      return {
        statusCode: 400,
        body: JSON.stringify(data),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error creating tracking:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create tracking' }),
    };
  }
};

export { handler }; 