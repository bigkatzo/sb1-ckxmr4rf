/**
 * Utility to fetch orders directly using fetch API instead of Supabase SDK
 * This approach is more robust against SDK-specific parsing errors
 */
export async function getOrdersDirect(walletAddress: string, walletAuthToken: string) {
  // Get Supabase URL and key from environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or key not found in environment variables');
  }

  // First try test_wallet_auth function to diagnose any header issues
  try {
    const testResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/test_wallet_auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'X-Wallet-Address': walletAddress,
          'X-Wallet-Auth-Token': walletAuthToken
        },
        body: JSON.stringify({ wallet_addr: walletAddress })
      }
    );

    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log('Wallet auth diagnostic test:', testData);
      
      // If auth is failing, log detailed debug info
      if (!testData.debug_info?.result) {
        console.warn('Wallet auth is failing:', testData.debug_info);
      }
    }
  } catch (testErr) {
    console.error('Error running auth diagnostic test:', testErr);
  }

  // Try user_orders view
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/user_orders?select=*&order=created_at.desc`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'X-Wallet-Address': walletAddress,
          'X-Wallet-Auth-Token': walletAuthToken
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Orders query failed with status: ${response.status}`);
    }
    
    const data = await response.json();

    console.log('Orders from user_orders view:', data);

    if (Array.isArray(data) && data.length > 0) {
      return {
        data,
        source: 'user_orders_view',
        error: null
      };
    } else {
      console.warn('user_orders view returned empty array, headers might not be working');
    }
  } catch (viewErr) {
    console.error('Error fetching from user_orders view:', viewErr);
    // Continue to fallback method
  }

  // If view didn't work, try the get_wallet_orders RPC function instead of direct table access
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_wallet_orders`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'X-Wallet-Address': walletAddress,
          'X-Wallet-Auth-Token': walletAuthToken
        },
        body: JSON.stringify({ wallet_addr: walletAddress })
      }
    );
    
    if (!response.ok) {
      throw new Error(`RPC orders query failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      // Get product and collection info to enrich orders if needed
      const productsPromise = fetch(
        `${supabaseUrl}/rest/v1/products?select=id,name,sku,category_id`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'X-Wallet-Address': walletAddress,
            'X-Wallet-Auth-Token': walletAuthToken
          }
        }
      ).then(r => r.ok ? r.json() : []);
      
      const collectionsPromise = fetch(
        `${supabaseUrl}/rest/v1/collections?select=id,name`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'X-Wallet-Address': walletAddress,
            'X-Wallet-Auth-Token': walletAuthToken
          }
        }
      ).then(r => r.ok ? r.json() : []);
      
      // Process in parallel
      const [productsData, collectionsData] = await Promise.all([
        productsPromise, collectionsPromise
      ]);
      
      // Create lookup maps
      const products = (Array.isArray(productsData) ? productsData : []).reduce((acc, product) => {
        acc[product.id] = product;
        return acc;
      }, {});
      
      const collections = (Array.isArray(collectionsData) ? collectionsData : []).reduce((acc, collection) => {
        acc[collection.id] = collection;
        return acc;
      }, {});
      
      // Enrich orders with extra data if not already present
      const enrichedData = data.map(order => {
        const product = products[order.product_id] || {};
        const collection = collections[order.collection_id] || {};
        
        return {
          ...order,
          product_name: order.product_name || product.name || 'Unknown Product',
          product_sku: order.product_sku || product.sku || '',
          collection_name: order.collection_name || collection.name || 'Unknown Collection',
          category_name: order.category_name || ''
        };
      });
      
      console.log('Orders from RPC function:', enrichedData.slice(0, 1));
      return {
        data: enrichedData,
        source: 'rpc_function',
        error: null
      };
    }
    
    // If we got an empty array, there might just not be any orders
    return {
      data: [],
      source: 'rpc_function',
      error: null
    };
  } catch (rpcErr) {
    console.error('Error fetching from RPC function:', rpcErr);
    
    // Last resort, try the fallback RPC function
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_wallet_orders_direct`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'X-Wallet-Address': walletAddress,
            'X-Wallet-Auth-Token': walletAuthToken
          },
          body: JSON.stringify({ wallet_addr: walletAddress })
        }
      );
      
      if (!response.ok) {
        throw new Error(`Fallback wallet orders RPC failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        data,
        source: 'fallback_rpc_function',
        error: null
      };
    } catch (fallbackErr) {
      // Get debug info as a last resort
      try {
        const debugResponse = await fetch(
          `${supabaseUrl}/rest/v1/rpc/debug_auth_status`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'X-Wallet-Address': walletAddress,
              'X-Wallet-Auth-Token': walletAuthToken
            }
          }
        );
        
        if (debugResponse.ok) {
          const debugData = await debugResponse.json();
          console.error('Auth debug info:', debugData);
        }
      } catch (debugErr) {
        // Ignore debug errors
      }
      
      return {
        data: [],
        source: null,
        error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
      };
    }
  }
} 