const path = require('path');
const fs = require('fs');

exports.handler = async function(event, context) {
  try {
    // Add CORS headers to handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
        }
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        deployId: process.env.NETLIFY_DEPLOY_ID || `build_${Date.now()}`,
        buildTime: process.env.BUILD_TIME || Date.now(),
        timestamp: Date.now()
      })
    };
  } catch (error) {
    console.error('Version function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        timestamp: Date.now()
      })
    };
  }
}; 