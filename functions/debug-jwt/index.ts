import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') as string,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
)

// This is a debug endpoint to help troubleshoot JWT claims
serve(async (req) => {
  // Get authorization header
  const authHeader = req.headers.get('Authorization')
  
  if (!authHeader) {
    return new Response(
      JSON.stringify({
        error: 'Missing Authorization header',
        status: 401,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      }
    )
  }
  
  // Extract token
  const token = authHeader.replace('Bearer ', '')
  
  try {
    // Get JWT payload without verification (for debugging only!)
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }
    
    // Decode the payload (middle part)
    const payload = JSON.parse(atob(parts[1]))
    
    // Debug utility functions to inspect JWT structure
    function findWalletInObject(obj: any, path = ''): Array<{path: string, value: string}> {
      let results: Array<{path: string, value: string}> = []
      
      if (typeof obj !== 'object' || obj === null) {
        return results
      }
      
      Object.entries(obj).forEach(([key, value]) => {
        const currentPath = path ? `${path}.${key}` : key
        
        // Check if this key is wallet-related
        if (
          key === 'wallet_address' || 
          key === 'walletAddress' || 
          (key.includes('wallet') && typeof value === 'string')
        ) {
          results.push({
            path: currentPath,
            value: value as string
          })
        }
        
        // Recursively check nested objects
        if (typeof value === 'object' && value !== null) {
          results = results.concat(findWalletInObject(value, currentPath))
        }
      })
      
      return results
    }
    
    // Execute a debug query to check JWT handling in database
    const { data: dbDebugData, error: dbDebugError } = await supabase.rpc('debug_jwt_wallet')
    
    // Check for orders matching the wallet address
    let ordersData = null
    let ordersError = null
    let walletAddress = null
    
    // Try to extract wallet address from any of the locations
    const walletLocations = findWalletInObject(payload)
    if (walletLocations.length > 0) {
      walletAddress = walletLocations[0].value
      
      // Check orders for this wallet
      const { data: orders, error: ordersQueryError } = await supabase
        .from('orders')
        .select('id, order_number, wallet_address, status')
        .eq('wallet_address', walletAddress)
      
      ordersData = orders
      ordersError = ordersQueryError
    }
    
    // Return all the debug information
    return new Response(
      JSON.stringify({
        success: true,
        jwtStructure: {
          payloadSize: JSON.stringify(payload).length,
          walletLocations,
          extractedWalletAddress: walletAddress,
        },
        authInfo: {
          tokenType: payload.typ,
          sub: payload.sub,
          hasUserMetadata: Boolean(payload.user_metadata),
          hasAppMetadata: Boolean(payload.app_metadata),
        },
        databaseDebug: {
          supabaseExtracted: dbDebugData,
          error: dbDebugError ? dbDebugError.message : null,
        },
        ordersCheck: {
          walletAddress,
          count: ordersData ? ordersData.length : 0,
          orders: ordersData,
          error: ordersError ? ordersError.message : null,
        },
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: `Error processing JWT: ${error.message}`,
        status: 500,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
}) 