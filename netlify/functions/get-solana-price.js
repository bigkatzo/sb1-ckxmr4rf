// In-memory cache to reduce API calls
let priceCache = {
  price: null,
  timestamp: null,
  ttl: 30000 // 30 seconds cache
};

// Simple rate limiting (in-memory, resets on cold start)
let requestCount = 0;
let windowStart = Date.now();
const RATE_LIMIT = 60; // 60 requests per minute
const WINDOW_MS = 60000; // 1 minute

exports.handler = async (event, context) => {
  // Restrict CORS to your domains only
  const allowedOrigins = [
    'https://store.fun',
    'https://www.store.fun', 
    'https://test--storefun.netlify.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  
  const origin = event.headers.origin;
  const corsOrigin = allowedOrigins.includes(origin) ? origin : 'null';
  
  const headers = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=30' // 30 second browser cache
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Simple rate limiting
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    requestCount = 0;
    windowStart = now;
  }
  
  if (requestCount >= RATE_LIMIT) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ 
        error: 'Rate limit exceeded',
        fallbackPrice: 180
      })
    };
  }
  requestCount++;

  // Check cache first
  if (priceCache.price && priceCache.timestamp && 
      (now - priceCache.timestamp) < priceCache.ttl) {
    console.log('Returning cached SOL price:', priceCache.price);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        price: priceCache.price,
        timestamp: new Date(priceCache.timestamp).toISOString(),
        cached: true
      })
    };
  }

  try {
    console.log('Fetching fresh Solana price from CoinGecko...');
    
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      {
        headers: {
          'User-Agent': 'store.fun-price-fetcher/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Validate response
    if (!data.solana || typeof data.solana.usd !== 'number') {
      throw new Error('Invalid response structure');
    }

    const price = data.solana.usd;
    
    // Update cache
    priceCache = {
      price: price,
      timestamp: now,
      ttl: 30000
    };

    console.log('Successfully fetched SOL price:', price);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        price: price,
        timestamp: new Date().toISOString(),
        cached: false
      })
    };

  } catch (error) {
    console.error('CoinGecko fetch error:', error.message);
    
    // Return cached price if available, even if expired
    if (priceCache.price) {
      console.log('Returning stale cached price due to error');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          price: priceCache.price,
          timestamp: new Date(priceCache.timestamp).toISOString(),
          stale: true
        })
      };
    }
    
    return {
      statusCode: 200, // Still return 200 with fallback
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Service temporarily unavailable',
        fallbackPrice: 180
      })
    };
  }
};