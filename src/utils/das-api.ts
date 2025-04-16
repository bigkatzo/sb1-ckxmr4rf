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
async function callDasApi<T>(method: string, params: any[]): Promise<T> {
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
  
  try {
    console.log(`Making DAS API call: ${method}`);
    
    // Make the request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-das',
        method,
        params,
      }),
    });
    
    // Check for response errors
    if (!response.ok) {
      throw new Error(`DAS API request failed: ${response.status} ${response.statusText}`);
    }
    
    // Parse response
    const result = await response.json();
    
    // Check for JSON-RPC errors
    if (result.error) {
      throw new Error(`DAS API error: ${result.error.message || JSON.stringify(result.error)}`);
    }
    
    // Cache successful result
    apiCache[cacheKey] = {
      timestamp: now,
      data: result.result,
    };
    
    return result.result as T;
  } catch (error) {
    console.error('DAS API call failed:', error);
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
  
  return callDasApi<DasAssetsResponse>('getAssetsByOwner', [
    ownerAddress,
    {
      page,
      limit,
      displayOptions: {
        showFungible,
      },
    },
  ]);
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
  
  return callDasApi<DasAssetsResponse>('getAssetsByGroup', [
    groupKey,
    groupValue,
    {
      page,
      limit,
    },
  ]);
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
  const { page = 1, limit = 1000 } = options;
  
  return callDasApi<DasAssetsResponse>('searchAssets', [
    {
      ownerAddress,
      grouping: [
        {
          groupKey: 'collection',
          groupValue: collectionAddress,
        },
      ],
      page,
      limit,
    },
  ]);
} 