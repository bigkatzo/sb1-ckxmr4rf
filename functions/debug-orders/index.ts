import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Create Supabase client with admin privileges
const adminSupabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
)

// Create a public client for testing user-level access
const publicSupabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_ANON_KEY') as string
)

serve(async (req) => {
  try {
    // Get authorization header for user's token
    const authHeader = req.headers.get('Authorization')
    
    // Get wallet address from query
    const url = new URL(req.url)
    const walletAddress = url.searchParams.get('wallet')
    
    if (!walletAddress) {
      return new Response(
        JSON.stringify({
          error: 'Missing wallet parameter',
          status: 400,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }
    
    // Direct table query using admin privileges (bypass RLS)
    const { data: directOrders, error: directError } = await adminSupabase
      .from('orders')
      .select('id, order_number, wallet_address, status, created_at')
      .eq('wallet_address', walletAddress)
    
    let publicResponse = null
    let publicError = null
    let userOrdersResponse = null
    let userOrdersError = null
    
    // Test with the user's token if provided
    if (authHeader) {
      const userToken = authHeader.replace('Bearer ', '')
      
      // Create a client with the user's token
      const userSupabase = createClient(
        Deno.env.get('SUPABASE_URL') as string,
        Deno.env.get('SUPABASE_ANON_KEY') as string,
        {
          global: {
            headers: {
              Authorization: `Bearer ${userToken}`
            }
          }
        }
      )
      
      // Try regular public access
      try {
        const publicResult = await publicSupabase
          .from('orders')
          .select('id, order_number, wallet_address, status')
          .eq('wallet_address', walletAddress)
        
        publicResponse = publicResult.data
        publicError = publicResult.error
      } catch (err) {
        publicError = err
      }
      
      // Try user_orders view with the user's token
      try {
        const userOrdersResult = await userSupabase
          .from('user_orders')
          .select('id, order_number, wallet_address, status')
        
        userOrdersResponse = userOrdersResult.data
        userOrdersError = userOrdersResult.error
      } catch (err) {
        userOrdersError = err
      }
      
      // Try to get debugging info from the special function
      try {
        const { data: debugData, error: debugError } = await userSupabase
          .rpc('debug_orders_for_wallet', { target_wallet: walletAddress })
        
        // Return all debugging info
        return new Response(
          JSON.stringify({
            success: true,
            wallet: walletAddress,
            directAccess: {
              count: directOrders?.length || 0,
              orders: directOrders,
              error: directError?.message
            },
            publicAccess: {
              count: publicResponse?.length || 0,
              error: publicError?.message
            },
            userOrdersView: {
              count: userOrdersResponse?.length || 0,
              error: userOrdersError?.message
            },
            diagnostics: {
              debug: debugData,
              error: debugError?.message
            }
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      } catch (diagnosticError) {
        // If diagnostic function doesn't exist yet, return without it
        return new Response(
          JSON.stringify({
            success: true,
            wallet: walletAddress,
            directAccess: {
              count: directOrders?.length || 0,
              orders: directOrders,
              error: directError?.message
            },
            publicAccess: {
              count: publicResponse?.length || 0,
              error: publicError?.message
            },
            userOrdersView: {
              count: userOrdersResponse?.length || 0,
              error: userOrdersError?.message
            },
            diagnostics: {
              error: 'Diagnostic function not available'
            }
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }
    
    // If no auth header, just return direct access results
    return new Response(
      JSON.stringify({
        success: true,
        wallet: walletAddress,
        directAccess: {
          count: directOrders?.length || 0,
          orders: directOrders,
          error: directError?.message
        },
        auth: 'No authentication provided'
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: `Error processing request: ${error.message}`,
        status: 500,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 