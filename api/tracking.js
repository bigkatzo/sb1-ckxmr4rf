// Tracking API proxy endpoint to avoid Content Security Policy issues
// This endpoint forwards requests to 17TRACK API from the server side

import fetch from 'node-fetch';

// 17TRACK API configuration
const SEVENTEEN_TRACK_API_URL = 'https://api.17track.net/track/v2.2';
const SEVENTEEN_TRACK_API_KEY = process.env.VITE_SEVENTEEN_TRACK_API_KEY || process.env.SEVENTEEN_TRACK_API_KEY;

/**
 * Helper function to return standardized API responses
 */
const createResponse = (success, data = null, message = null, status = 200) => {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Adjust to be more restrictive in production
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify({
      success,
      data,
      message
    })
  };
};

/**
 * Main handler for tracking API requests
 */
export default async function handler(req, res) {
  try {
    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
      return createResponse(true);
    }

    // Only support POST requests
    if (req.method !== 'POST') {
      return createResponse(false, null, 'Method not allowed', 405);
    }

    // Get the API endpoint type from path segments
    const path = req.url.split('/');
    const endpoint = path[path.length - 1]; // Last segment of the URL path

    // Check for valid endpoints
    if (!['register', 'delete', 'status'].includes(endpoint)) {
      return createResponse(false, null, 'Invalid endpoint', 400);
    }

    // Extract request body
    const payload = req.body;

    // Map endpoint to 17TRACK API endpoint
    let apiEndpoint;
    let apiPayload;

    switch (endpoint) {
      case 'register':
        apiEndpoint = `${SEVENTEEN_TRACK_API_URL}/register`;
        apiPayload = [{
          number: payload.number,
          auto_detection: payload.auto_detection || true,
          order_id: payload.order_id
        }];
        break;
      
      case 'delete':
        apiEndpoint = `${SEVENTEEN_TRACK_API_URL}/deletetrack`;
        apiPayload = [{
          number: payload.number,
          carrier: payload.carrier // Optional
        }];
        break;
      
      case 'status':
        apiEndpoint = `${SEVENTEEN_TRACK_API_URL}/gettrackinfo`;
        apiPayload = [{
          number: payload.number,
          carrier: payload.carrier // Optional
        }];
        break;
    }

    // Forward request to 17TRACK API
    console.log(`Proxying request to ${apiEndpoint}`, apiPayload);
    
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
    console.log('17TRACK API response:', result);

    // Handle successful response
    if (result.code === 0) {
      return createResponse(true, result.data, 'Success');
    } 
    
    // Handle API errors
    const errorMessage = result.message || 'Unknown error from tracking API';
    console.error('17TRACK API error:', errorMessage);
    return createResponse(false, result.data, errorMessage, 400);
  } catch (error) {
    // Handle unexpected errors
    console.error('Error in tracking API proxy:', error);
    return createResponse(false, null, error.message || 'Internal server error', 500);
  }
} 