/**
 * CLEANUP STALE ORDERS
 * 
 * This function cleans up stale draft orders that are older than a specified threshold.
 * It's designed to be run on a scheduled basis (e.g. daily) to prevent database clutter.
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event, context) => {
  // Only allow scheduled tasks and manual admin invocations
  if (event.httpMethod === 'GET' && !event.headers.authorization) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Validate authorization for manual invocations
  if (event.httpMethod === 'GET' && event.headers.authorization) {
    const token = event.headers.authorization.replace('Bearer ', '');
    if (token !== process.env.ADMIN_API_KEY) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid API key' })
      };
    }
  }

  try {
    // Get the threshold from query params or use default (24 hours)
    const hoursThreshold = event.queryStringParameters?.hours || 24;
    
    // Call the cleanup function
    const { data: cleanedCount, error } = await supabase.rpc('cleanup_stale_orders', {
      p_hours_threshold: parseInt(hoursThreshold, 10)
    });

    if (error) {
      console.error('Error cleaning up stale orders:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to clean up stale orders' })
      };
    }

    console.log(`Successfully cleaned up ${cleanedCount} stale orders`);
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        cleaned: cleanedCount,
        threshold: `${hoursThreshold} hours`
      })
    };
  } catch (err) {
    console.error('Exception in cleanup function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: err.message 
      })
    };
  }
}; 