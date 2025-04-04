import { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const { tracking_number } = JSON.parse(event.body || '{}');
    
    if (!tracking_number) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Tracking number is required' }),
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

    const response = await fetch('https://api.trackship.com/v1/shipment/get/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'trackship-api-key': trackshipApiKey,
        'app-name': appName,
      },
      body: JSON.stringify({
        tracking_number,
      }),
    });

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Error fetching tracking status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch tracking status' }),
    };
  }
};

export { handler }; 