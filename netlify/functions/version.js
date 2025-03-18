const { version } = require('../../package.json');

exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    body: JSON.stringify({
      version,
      timestamp: Date.now(),
      deployId: process.env.NETLIFY_DEPLOY_ID || null,
      buildTime: process.env.BUILD_TIME || Date.now()
    })
  };
}; 