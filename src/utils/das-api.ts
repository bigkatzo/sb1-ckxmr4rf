import { HELIUS_API_KEY } from '../config/solana';

// DAS API base URL
const DAS_API_URL = 'https://mainnet.helius-rpc.com';

// Types for DAS API responses
export interface DasAsset {
  id: string;
  content: {
    json_uri: string;
    metadata: {
      name: string;
      symbol: string;
      description: string;
      image: string;
      attributes: Array<{
        trait_type: string;
        value: string;
      }>;
      // Other metadata fields
    };
    files?: Array<{
      uri: string;
      type: string;
    }>;
  };
  authorities: Array<{
    address: string;
    scopes: string[];
  }>;
  compression: {
    eligible: boolean;
    compressed: boolean;
    data_hash: string;
    creator_hash: string;
    asset_hash: string;
    tree: string;
    seq: number;
    leaf_id: number;
  };
  grouping: Array<{
    group_key: string;
    group_value: string;
  }>;
  royalty: {
    royalty_model: string;
    target: string;
    percent: number;
    basis_points: number;
    primary_sale_happened: boolean;
    locked: boolean;
  };
  creators: Array<{
    address: string;
    share: number;
    verified: boolean;
  }>;
  ownership: {
    owner: string;
    delegate: string;
    delegated: boolean;
    ownership_model: string;
    frozen: boolean;
  };
  supply: {
    print_max_supply: number;
    print_current_supply: number;
    edition_nonce: number;
  };
  mutable: boolean;
  burnt: boolean;
  // New field for collection data in the updated API
  collection?: {
    address: string;
    verified: boolean;
    name?: string;
  };
}

export interface DasAssetsResponse {
  total: number;
  limit: number;
  page: number;
  items: DasAsset[];
}

// Cache for DAS API responses
interface DasApiCache {
  [key: string]: {
    timestamp: number;
    data: any;
  };
}

// Cache expiry in milliseconds (10 minutes)
const CACHE_EXPIRY = 10 * 60 * 1000;

// Initialize cache
const apiCache: DasApiCache = {};

// Rate limit settings
const RATE_LIMIT_DELAY = 200; // 200ms delay between API calls
let lastApiCallTime = 0;

// Toggle for verbose logging
const VERBOSE_LOGGING = false;

/**
 * Helper function for controlled logging
 */
function logInfo(message: string, data?: any): void {
  if (VERBOSE_LOGGING) {
    console.log(message, data || '');
  }
}

/**
 * Make a call to the DAS API with proper error handling, caching, and rate limiting
 */
async function callDasApi<T>(method: string, params: any): Promise<T> {
  // Rate limiting - ensure minimum time between API calls
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTime;
  if (timeSinceLastCall < RATE_LIMIT_DELAY) {
    const delayNeeded = RATE_LIMIT_DELAY - timeSinceLastCall;
    logInfo(`Rate limiting: Waiting ${delayNeeded}ms before next API call`);
    await new Promise(resolve => setTimeout(resolve, delayNeeded));
  }
  lastApiCallTime = Date.now();
  
  // Generate cache key based on request
  const cacheKey = `${method}-${JSON.stringify(params)}`;
  
  // Check cache first
  if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_EXPIRY) {
    logInfo(`Using cached DAS API response for ${method}`);
    return apiCache[cacheKey].data as T;
  }
  
  // If no API key, throw an error
  if (!HELIUS_API_KEY) {
    throw new Error('Helius API key is required for DAS API calls');
  }
  
  // Setup request
  const url = `${DAS_API_URL}/?api-key=${HELIUS_API_KEY}`;
  const requestBody = {
    jsonrpc: '2.0',
    id: 'helius-das',
    method,
    params,
  };
  
  logInfo(`Making DAS API call: ${method}`, VERBOSE_LOGGING ? params : null);
  
  try {
    // Make the request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    // Handle rate limit responses (429 Too Many Requests)
    if (response.status === 429) {
      console.warn('Rate limit exceeded on DAS API, will retry after delay');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      return callDasApi(method, params); // Retry the request
    }
    
    // Check for response errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error('DAS API HTTP error:', {
        status: response.status,
        statusText: response.statusText,
        responseBody: errorText.substring(0, 200) // Log part of the response to help debug
      });
      throw new Error(`DAS API request failed: ${response.status} ${response.statusText}`);
    }
    
    // Parse response
    const result = await response.json();
    
    // Check for JSON-RPC errors
    if (result.error) {
      console.error('DAS API JSON-RPC error:', result.error);
      throw new Error(`DAS API error: ${result.error.message || JSON.stringify(result.error)}`);
    }
    
    // Ensure the result is valid
    if (result.result === undefined) {
      console.error('DAS API returned an undefined result', result);
      throw new Error('DAS API returned an invalid response format');
    }
    
    // Cache successful result
    apiCache[cacheKey] = {
      timestamp: Date.now(),
      data: result.result,
    };
    
    return result.result as T;
  } catch (error) {
    console.error('DAS API call failed:', {
      method,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Get all assets owned by an address
 */
export async function getAssetsByOwner(
  ownerAddress: string,
  options: {
    page?: number;
    limit?: number;
    showFungible?: boolean;
  } = {}
): Promise<DasAssetsResponse> {
  const { page = 1, limit = 1000, showFungible = false } = options;
  
  // Create params with the fields the API actually supports
  const params = {
    ownerAddress,
    page,
    limit,
    displayOptions: {
      showFungible,
      showCollectionMetadata: true
    }
  };
  
  return callDasApi<DasAssetsResponse>('getAssetsByOwner', params);
}

/**
 * Get assets by their collection/group
 */
export async function getAssetsByGroup(
  groupKey: string,
  groupValue: string,
  options: {
    page?: number;
    limit?: number;
  } = {}
): Promise<DasAssetsResponse> {
  const { page = 1, limit = 1000 } = options;
  
  return callDasApi<DasAssetsResponse>('getAssetsByGroup', {
    groupKey,
    groupValue,
    page,
    limit
  });
}

/**
 * Get all assets owned by an address with pagination support for large wallets
 * This automatically handles fetching multiple pages if needed
 */
export async function getAllAssetsByOwner(
  ownerAddress: string,
  options: {
    showFungible?: boolean;
    maxPages?: number;
  } = {}
): Promise<DasAsset[]> {
  const { showFungible = false, maxPages = 5 } = options;
  let allAssets: DasAsset[] = [];
  let currentPage = 1;
  let hasMorePages = true;
  
  logInfo(`Fetching all assets for wallet ${ownerAddress} with pagination`);
  
  while (hasMorePages && currentPage <= maxPages) {
    try {
      logInfo(`Fetching assets page ${currentPage}`);
      const response = await getAssetsByOwner(ownerAddress, {
        page: currentPage,
        limit: 1000,
        showFungible
      });
      
      if (!response || !Array.isArray(response.items) || response.items.length === 0) {
        // No more items or invalid response
        hasMorePages = false;
      } else {
        // Add these items to our collection
        allAssets = [...allAssets, ...response.items];
        logInfo(`Added ${response.items.length} items from page ${currentPage}, total: ${allAssets.length}`);
        
        // Check if we've reached the end
        if (response.items.length < 1000) {
          hasMorePages = false;
        } else {
          // Move to next page
          currentPage++;
        }
      }
    } catch (error) {
      console.error(`Error fetching page ${currentPage}:`, error);
      hasMorePages = false; // Stop pagination on error
    }
  }
  
  return allAssets;
}

/**
 * Search for assets with specific criteria
 */
export async function searchAssets(
  ownerAddress: string,
  collectionAddress: string,
  options: {
    page?: number;
    limit?: number;
  } = {}
): Promise<DasAssetsResponse> {
  logInfo(`Searching assets for wallet ${ownerAddress} and collection ${collectionAddress}`);
  
  // Get all NFTs with pagination support for large wallets
  const allAssets = await getAllAssetsByOwner(ownerAddress);
  
  if (!allAssets || allAssets.length === 0) {
    return { items: [], total: 0, limit: options.limit || 1000, page: options.page || 1 };
  }
  
  // Filter for the specific collection
  const filteredItems = allAssets.filter(asset => {
    // Check grouping for collection
    if (asset.grouping) {
      const collectionGrouping = asset.grouping.find(g => g.group_key === 'collection');
      if (collectionGrouping && collectionGrouping.group_value === collectionAddress) {
        return true;
      }
    }
    
    // Also check the collection field if it exists
    if (asset.collection && asset.collection.address === collectionAddress) {
      return true;
    }
    
    return false;
  });
  
  return {
    items: filteredItems,
    total: filteredItems.length,
    limit: options.limit || 1000,
    page: options.page || 1
  };
} 