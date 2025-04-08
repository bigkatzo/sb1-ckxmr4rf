import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import fetch from 'node-fetch';

// 17TRACK API configuration
const SEVENTEEN_TRACK_API_URL = 'https://api.17track.net/track/v2.2';
const SEVENTEEN_TRACK_API_KEY = process.env.VITE_SEVENTEEN_TRACK_API_KEY || process.env.SEVENTEEN_TRACK_API_KEY;

interface ApiRequest {
  action: 'register' | 'delete' | 'status';
  payload: any;
}

/**
 * Netlify Function to proxy requests to 17TRACK API to avoid CSP issues
 */
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Set CORS headers to allow the frontend to call this endpoint
  const headers = {
    'Access-Control-Allow-Origin': '*', // Restrict to your domain in production
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Preflight call successful' })
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const requestBody: ApiRequest = JSON.parse(event.body || '{}');
    
    if (!requestBody.action || !requestBody.payload) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Invalid request. Required fields: action, payload'
        })
      };
    }

    // Map action to 17TRACK API endpoint
    let apiEndpoint: string;
    let apiPayload: any;

    switch (requestBody.action) {
      case 'register':
        apiEndpoint = `${SEVENTEEN_TRACK_API_URL}/register`;
        apiPayload = [{
          number: requestBody.payload.number,
          auto_detection: requestBody.payload.auto_detection !== false,
          order_id: requestBody.payload.order_id
        }];
        break;
      
      case 'delete':
        apiEndpoint = `${SEVENTEEN_TRACK_API_URL}/deletetrack`;
        apiPayload = [{
          number: requestBody.payload.number,
          carrier: requestBody.payload.carrier // Optional
        }];
        break;
      
      case 'status':
        apiEndpoint = `${SEVENTEEN_TRACK_API_URL}/gettrackinfo`;
        apiPayload = [{
          number: requestBody.payload.number,
          carrier: requestBody.payload.carrier // Optional
        }];
        break;
      
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            message: `Unsupported action: ${requestBody.action}`
          })
        };
    }

    // Check for API key
    if (!SEVENTEEN_TRACK_API_KEY) {
      console.error('Missing 17TRACK API key in environment variables', {
        availableEnvVars: Object.keys(process.env).filter(key => !key.includes('SECRET') && !key.includes('KEY')).join(', ')
      });
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Server configuration error: Missing 17TRACK API key'
        })
      };
    }

    // Log debugging info
    console.log('17TRACK API request details:', {
      endpoint: apiEndpoint,
      hasApiKey: !!SEVENTEEN_TRACK_API_KEY,
      apiKeyLength: SEVENTEEN_TRACK_API_KEY ? SEVENTEEN_TRACK_API_KEY.length : 0
    });

    // Forward request to 17TRACK API
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': SEVENTEEN_TRACK_API_KEY
      },
      body: JSON.stringify(apiPayload)
    });

    // Parse 17TRACK API response
    const result = await response.json();
    
    // Log the response for debugging
    console.log('17TRACK API response:', JSON.stringify(result));

    // Forward the response back to the client
    if (result.code === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: result.data,
          message: 'Success'
        })
      };
    } else {
      // Handle API errors
      const errorMessage = result.message || 'Unknown error from 17TRACK API';
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          message: errorMessage,
          data: result.data
        })
      };
    }
  } catch (error) {
    // Handle unexpected errors
    console.error('Error in tracking API proxy:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      })
    };
  }
};

export { handler }; 