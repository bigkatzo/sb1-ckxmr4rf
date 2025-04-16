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

/**
 * Make a call to the DAS API with proper error handling and caching
 */
async function callDasApi<T>(method: string, params: any): Promise<T> {
  // Generate cache key based on request
  const cacheKey = `${method}-${JSON.stringify(params)}`;
  const now = Date.now();
  
  // Check cache first
  if (apiCache[cacheKey] && now - apiCache[cacheKey].timestamp < CACHE_EXPIRY) {
    console.log(`Using cached DAS API response for ${method}`);
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
  
  console.log(`Making DAS API call: ${method}`, params);
  
  try {
    // Make the request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
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
    
    // Debug the response
    console.log(`DAS API ${method} response:`, {
      success: !result.error,
      errorDetails: result.error || 'none'
    });
    
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
      timestamp: now,
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
    collectionAddress?: string;
  } = {}
): Promise<DasAssetsResponse> {
  const { page = 1, limit = 1000, showFungible = false, collectionAddress } = options;
  
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
  console.log(`Searching assets for wallet ${ownerAddress} and collection ${collectionAddress}`);
  
  // Get all NFTs and then filter them client-side
  const allAssets = await getAssetsByOwner(ownerAddress, options);
  
  if (!allAssets || !Array.isArray(allAssets.items)) {
    console.log('No assets found or invalid response format');
    return { items: [], total: 0, limit: options.limit || 1000, page: options.page || 1 };
  }
  
  console.log(`Found ${allAssets.items.length} total assets, filtering for collection ${collectionAddress}`);
  
  // Filter for the specific collection
  const filteredItems = allAssets.items.filter(asset => {
    // Check grouping for collection
    if (asset.grouping) {
      const collectionGrouping = asset.grouping.find(g => g.group_key === 'collection');
      if (collectionGrouping && collectionGrouping.group_value === collectionAddress) {
        console.log(`Found matching NFT with id ${asset.id} from grouping`);
        return true;
      }
    }
    
    // Also check the collection field if it exists
    if (asset.collection && asset.collection.address === collectionAddress) {
      console.log(`Found matching NFT with id ${asset.id} from collection field`);
      return true;
    }
    
    return false;
  });
  
  console.log(`Filtered to ${filteredItems.length} assets matching collection ${collectionAddress}`);
  
  return {
    items: filteredItems,
    total: filteredItems.length,
    limit: options.limit || 1000,
    page: options.page || 1
  };
} 