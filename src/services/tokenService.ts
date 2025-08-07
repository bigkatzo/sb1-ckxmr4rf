// Token service to replace Jupiter's deprecated API
// Uses multiple sources for better coverage and reliability

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals?: number;
  logoURI?: string;
  address: string;
  verified?: boolean;
  timestamp?: number; // For internal caching
}

export interface TokenSearchResult {
  tokens: TokenInfo[];
  loading: boolean;
  error?: string;
}

class TokenService {
  private cache = new Map<string, TokenInfo>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private async fetchWithTimeout(url: string, timeout: number = 5000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  private getCachedToken(address: string): TokenInfo | null {
    const cached = this.cache.get(address);
    if (cached && cached.timestamp && this.isCacheValid(cached.timestamp)) {
      return cached;
    }
    return null;
  }

  private setCachedToken(address: string, tokenInfo: TokenInfo): void {
    this.cache.set(address, { ...tokenInfo, timestamp: Date.now() });
  }

  // Primary method to get token information
  async getTokenInfo(address: string): Promise<TokenInfo> {
    const cleanAddress = address.trim();
    
    // Check cache first
    const cached = this.getCachedToken(cleanAddress);
    if (cached) {
      return cached;
    }

    // Try multiple sources in order of preference
    const sources = [
      () => this.fetchFromJupiter(cleanAddress), // Keep as fallback for now
      () => this.fetchFromDexScreener(cleanAddress),
      // () => this.fetchFromBirdeye(cleanAddress),
      // () => this.fetchFromSolscan(cleanAddress),
    ];

    for (const source of sources) {
      try {
        const tokenInfo = await source();
        if (tokenInfo) {
          this.setCachedToken(cleanAddress, tokenInfo);
          return tokenInfo;
        }
      } catch (error) {
        console.warn(`Failed to fetch token info from source:`, error);
        continue;
      }
    }

    // Return default token info if all sources fail
    const defaultToken: TokenInfo = {
      name: 'Custom Token',
      symbol: 'TOKEN',
      decimals: 6,
      address: cleanAddress,
      verified: false
    };
    
    this.setCachedToken(cleanAddress, defaultToken);
    return defaultToken;
  }

  // Fetch from Birdeye API
  private async fetchFromBirdeye(address: string): Promise<TokenInfo | null> {
    try {
      const response = await this.fetchWithTimeout(
        `https://public-api.birdeye.so/public/token_list?address=${address}`,
        3000
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        const token = data.data[0];
        return {
          name: token.name || 'Unknown Token',
          symbol: token.symbol || 'TOKEN',
          decimals: token.decimals || 6,
          logoURI: token.logoURI,
          address: address,
          verified: token.verified || false
        };
      }
      return null;
    } catch (error) {
      console.warn('Birdeye API error:', error);
      return null;
    }
  }

  // Fetch from Solscan API
  private async fetchFromSolscan(address: string): Promise<TokenInfo | null> {
    try {
      const response = await this.fetchWithTimeout(
        `https://api.solscan.io/token/meta?token=${address}`,
        3000
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data.success && data.data) {
        return {
          name: data.data.name || 'Unknown Token',
          symbol: data.data.symbol || 'TOKEN',
          decimals: data.data.decimals || 6,
          logoURI: data.data.logoURI,
          address: address,
          verified: data.data.verified || false
        };
      }
      return null;
    } catch (error) {
      console.warn('Solscan API error:', error);
      return null;
    }
  }

  // Fetch from DexScreener API
  private async fetchFromDexScreener(address: string): Promise<TokenInfo | null> {
    try {
      const response = await this.fetchWithTimeout(
        `https://api.dexscreener.com/latest/dex/tokens/${address}`,
        3000
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        const token = pair.baseToken || pair.token0;
        
        return {
          name: token.name || 'Unknown Token',
          symbol: token.symbol || 'TOKEN',
          decimals: token.decimals || 6,
          logoURI: token.logoURI,
          address: address,
          verified: false
        };
      }
      return null;
    } catch (error) {
      console.warn('DexScreener API error:', error);
      return null;
    }
  }

  // Keep Jupiter as fallback for now
  private async fetchFromJupiter(address: string): Promise<TokenInfo | null> {
    try {
      const response = await this.fetchWithTimeout(
        `https://tokens.jup.ag/token/${address}`,
        3000
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return {
        name: data.name || 'Unknown Token',
        symbol: data.symbol || 'TOKEN',
        decimals: data.decimals || 6,
        logoURI: data.logoURI,
        address: address,
        verified: false
      };
    } catch (error) {
      console.warn('Jupiter API error:', error);
      return null;
    }
  }

  // Search for tokens by name or symbol
  async searchTokens(query: string): Promise<TokenSearchResult> {
    if (!query.trim()) {
      return { tokens: [], loading: false };
    }

    try {
      // Try Birdeye search first
      const response = await this.fetchWithTimeout(
        `https://public-api.birdeye.so/public/token_list?search=${encodeURIComponent(query)}&limit=10`,
        3000
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const tokens: TokenInfo[] = data.data.map((token: any) => ({
            name: token.name || 'Unknown Token',
            symbol: token.symbol || 'TOKEN',
            decimals: token.decimals || 6,
            logoURI: token.logoURI,
            address: token.address,
            verified: token.verified || false
          }));
          
          return { tokens, loading: false };
        }
      }
      
      return { tokens: [], loading: false };
    } catch (error) {
      console.warn('Token search error:', error);
      return { tokens: [], loading: false, error: 'Failed to search tokens' };
    }
  }

  // Get multiple tokens at once
  async getMultipleTokens(addresses: string[]): Promise<TokenInfo[]> {
    const promises = addresses.map(address => this.getTokenInfo(address));
    return Promise.all(promises);
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Extract contract address from various URL formats
  extractContractAddress(input: string): string {
    let address = input.trim();
    
    // Extract from DexScreener URLs
    const dexScreenerMatch = address.match(/dexscreener\.com\/[^\/]+\/([a-zA-Z0-9]+)/);
    if (dexScreenerMatch) {
      address = dexScreenerMatch[1];
    }
    
    // Extract from PumpFun URLs
    const pumpFunMatch = address.match(/pump\.fun\/([a-zA-Z0-9]+)/);
    if (pumpFunMatch) {
      address = pumpFunMatch[1];
    }
    
    // Extract from Birdeye URLs
    const birdeyeMatch = address.match(/birdeye\.so\/token\/([a-zA-Z0-9]+)/);
    if (birdeyeMatch) {
      address = birdeyeMatch[1];
    }
    
    // Remove any remaining URL parts and clean the address
    address = address.replace(/^https?:\/\//, '').split('/').pop() || address;
    
    return address;
  }

  // Validate contract address format
  isValidAddress(address: string): boolean {
    const cleanAddress = this.extractContractAddress(address);
    return cleanAddress.length >= 32 && /^[a-zA-Z0-9]+$/.test(cleanAddress);
  }
}

// Export singleton instance
export const tokenService = new TokenService(); 