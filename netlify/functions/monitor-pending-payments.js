/**
 * MONITOR PENDING PAYMENTS
 * 
 * This function monitors orders stuck in pending_payment status
 * and provides data for manual review. It doesn't automatically
 * clean up or modify orders - just reports on them.
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Use service key for admin access
);

exports.handler = async (event, context) => {
  // Only allow GET requests with proper authorization
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Validate authorization
  const authHeader = event.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Missing authentication' })
    };
  }

  const token = authHeader.replace('Bearer ', '');
  if (token !== process.env.ADMIN_API_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid API key' })
    };
  }

  try {
    // Parse query parameters
    const params = event.queryStringParameters || {};
    const hoursThreshold = parseInt(params.hours || '24', 10);
    const limit = parseInt(params.limit || '50', 10);
    
    // Get stale pending payments
    const { data: pendingPayments, error } = await supabase.rpc('get_stale_pending_payments', {
      p_hours_threshold: hoursThreshold,
      p_limit: limit
    });

    if (error) {
      console.error('Error fetching stale pending payments:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Database query failed' })
      };
    }

    // Group payments by type for better analysis
    const groupedPayments = {
      stripe: pendingPayments.filter(p => p.payment_method === 'stripe' || p.transaction_signature.startsWith('pi_')),
      solana: pendingPayments.filter(p => p.payment_method === 'solana' && !p.transaction_signature.startsWith('pi_') && !p.transaction_signature.startsWith('free_')),
      free: pendingPayments.filter(p => p.payment_method === 'free' || p.transaction_signature.startsWith('free_')),
      other: pendingPayments.filter(p => !['stripe', 'solana', 'free'].includes(p.payment_method) && 
                                       !p.transaction_signature.startsWith('pi_') && 
                                       !p.transaction_signature.startsWith('free_'))
    };

    // Calculate some stats
    const stats = {
      total: pendingPayments.length,
      byType: {
        stripe: groupedPayments.stripe.length,
        solana: groupedPayments.solana.length,
        free: groupedPayments.free.length,
        other: groupedPayments.other.length
      },
      oldestByHours: pendingPayments.length > 0 
        ? Math.max(...pendingPayments.map(p => p.hours_pending))
        : 0,
      avgHoursPending: pendingPayments.length > 0
        ? pendingPayments.reduce((sum, p) => sum + p.hours_pending, 0) / pendingPayments.length
        : 0
    };

    return {
      statusCode: 200,
      body: JSON.stringify({
        stats,
        threshold: `${hoursThreshold} hours`,
        pendingPayments,
        groupedPayments
      })
    };
  } catch (err) {
    console.error('Error in monitoring function:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: err.message 
      })
    };
  }
}; 