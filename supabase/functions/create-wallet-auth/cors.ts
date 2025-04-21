// CORS headers middleware for Supabase Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Ideally, you'd set this to your specific domain(s)
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Handle preflight requests
export function handleCors(req: Request): Response | null {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  // Return null for non-OPTIONS requests to be handled by the main function
  return null;
} 