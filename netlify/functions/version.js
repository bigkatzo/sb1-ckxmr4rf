const path = require('path');
const fs = require('fs');

exports.handler = async function(event, context) {
  try {
    // Try to read version from package.json
    const packagePath = path.join(__dirname, '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const version = packageJson.version;

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
        deployId: process.env.NETLIFY_DEPLOY_ID || `build_${Date.now()}`,
        buildTime: process.env.BUILD_TIME || Date.now()
      })
    };
  } catch (error) {
    console.error('Version function error:', error);
    
    // Even if we can't read package.json, return a valid response with deploy ID
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify({
        version: '0.0.0',
        timestamp: Date.now(),
        deployId: process.env.NETLIFY_DEPLOY_ID || `build_${Date.now()}`,
        buildTime: process.env.BUILD_TIME || Date.now(),
        error: 'Could not read version from package.json'
      })
    };
  }
}; 