// Read version from package.json
const { version } = require('../package.json');

export default function handler(req, res) {
  // Set strict no-cache headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  res.status(200).json({
    version,
    timestamp: Date.now(),
    deployId: process.env.NETLIFY_DEPLOY_ID || null,
    buildTime: process.env.BUILD_TIME || Date.now()
  });
} 