const path = require('path');
const fs = require('fs');

exports.handler = async function(event) {
  console.log('Version function called:', {
    method: event.httpMethod,
    path: event.path,
    deployId: process.env.NETLIFY_DEPLOY_ID
  });

  // Handle CORS preflight
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

  // Return version info
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      deployId: process.env.NETLIFY_DEPLOY_ID || `build_${Date.now()}`,
      timestamp: Date.now()
    })
  };
}; 