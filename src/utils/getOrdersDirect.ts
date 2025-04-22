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

  // If view didn't work, try direct orders table with enhanced joins
  try {
    // First get products to join with orders
    const productsResponse = await fetch(
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
    );
    
    // Define types for products and collections
    interface Product {
      id: string;
      name: string;
      sku?: string;
      category_id?: string;
    }
    
    interface Collection {
      id: string;
      name: string;
    }
    
    let products: Record<string, Product> = {};
    if (productsResponse.ok) {
      const productsData = await productsResponse.json();
      products = productsData.reduce((acc: Record<string, Product>, product: Product) => {
        acc[product.id] = product;
        return acc;
      }, {});
    }
    
    // Get collections
    const collectionsResponse = await fetch(
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
    );
    
    let collections: Record<string, Collection> = {};
    if (collectionsResponse.ok) {
      const collectionsData = await collectionsResponse.json();
      collections = collectionsData.reduce((acc: Record<string, Collection>, collection: Collection) => {
        acc[collection.id] = collection;
        return acc;
      }, {});
    }
    
    // Now fetch direct orders
    const response = await fetch(
      `${supabaseUrl}/rest/v1/orders?select=*&wallet_address=eq.${walletAddress}&order=created_at.desc`,
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
      throw new Error(`Direct orders query failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Enrich orders with product and collection data
    const enrichedData = data.map((order: any) => {
      const product = products[order.product_id] || {} as Product;
      const collection = collections[order.collection_id] || {} as Collection;
      
      return {
        ...order,
        product_name: order.product_name || product.name || 'Unknown Product',
        product_sku: order.product_sku || product.sku || '',
        collection_name: order.collection_name || collection.name || 'Unknown Collection',
        category_name: order.category_name || ''
      };
    });
    
    console.log('Enhanced direct orders data:', enrichedData.slice(0, 1));
    return {
      data: enrichedData,
      source: 'orders_table_enhanced',
      error: null
    };
  } catch (directErr) {
    console.error('Error fetching from orders table:', directErr);
    
    // Last resort, try RPC function
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
        throw new Error(`Wallet orders RPC failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        data,
        source: 'rpc_function',
        error: null
      };
    } catch (rpcErr) {
      return {
        data: [],
        source: null,
        error: rpcErr instanceof Error ? rpcErr.message : String(rpcErr)
      };
    }
  }
} 