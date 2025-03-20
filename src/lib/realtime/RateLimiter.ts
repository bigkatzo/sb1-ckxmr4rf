import { logger } from './logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private static instance: RateLimiter;
  private buckets: Map<string, TokenBucket> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();
  private readonly DEFAULT_CONFIG: RateLimitConfig = {
    windowMs: 1000,    // 1 second
    maxRequests: 100   // 100 requests per second
  };

  private constructor() {
    // Initialize default rate limits for different operations
    this.configs.set('default', this.DEFAULT_CONFIG);
    this.configs.set('subscription', {
      windowMs: 5000,    // 5 seconds
      maxRequests: 50    // 10 requests per second
    });
    this.configs.set('presence', {
      windowMs: 1000,    // 1 second
      maxRequests: 20    // 20 presence updates per second
    });
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  public setConfig(key: string, config: RateLimitConfig): void {
    this.configs.set(key, config);
  }

  public async checkLimit(key: string, type: string = 'default'): Promise<boolean> {
    const config = this.configs.get(type) || this.DEFAULT_CONFIG;
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: config.maxRequests,
        lastRefill: Date.now()
      };
      this.buckets.set(key, bucket);
    }

    // Calculate token refill
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timePassed / config.windowMs) * config.maxRequests;

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if we have tokens available
    if (bucket.tokens > 0) {
      bucket.tokens--;
      return true;
    }

    logger.warn('Rate limit exceeded', {
      context: {
        key,
        type,
        windowMs: config.windowMs,
        maxRequests: config.maxRequests
      }
    });

    return false;
  }

  public async waitForToken(key: string, type: string = 'default'): Promise<void> {
    const config = this.configs.get(type) || this.DEFAULT_CONFIG;
    
    while (!(await this.checkLimit(key, type))) {
      await new Promise(resolve => setTimeout(resolve, config.windowMs / config.maxRequests));
    }
  }

  public getRemainingTokens(key: string, type: string = 'default'): number {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      const config = this.configs.get(type) || this.DEFAULT_CONFIG;
      return config.maxRequests;
    }
    return bucket.tokens;
  }
} 