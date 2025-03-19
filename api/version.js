// Read version from package.json
const { version } = require('../package.json');

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  
  res.status(200).json({
    version,
    timestamp: Date.now()
  });
} 