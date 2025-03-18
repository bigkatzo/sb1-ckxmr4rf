const path = require('path');
const fs = require('fs');

exports.handler = async function(event, context) {
  try {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        timestamp: Date.now()
      })
    };
  }
}; 