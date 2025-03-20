import { logger } from './logger';

export interface CircuitBreakerOptions {
  maxFailures?: number;
  resetTimeout?: number;
  fallbackValue?: any;
}

export class CircuitBreaker {
  private failures = 0;
  private readonly maxFailures: number;
  private readonly resetTimeout: number;
  private lastFailureTime = 0;
  private readonly fallbackValue: any;
  private readonly name: string;

  constructor(
    name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.name = name;
    this.maxFailures = options.maxFailures || 3;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.fallbackValue = options.fallbackValue || null;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T | null> {
    if (this.isOpen()) {
      logger.warn(`Circuit breaker open for ${this.name}`, {
        context: {
          failures: this.failures,
          lastFailure: new Date(this.lastFailureTime).toISOString()
        }
      });
      return this.fallbackValue;
    }

    try {
      const result = await operation();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      logger.error(`Operation failed in circuit breaker ${this.name}`, {
        context: {
          error,
          failures: this.failures,
          maxFailures: this.maxFailures
        }
      });
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failures >= this.maxFailures) {
      const now = Date.now();
      if (now - this.lastFailureTime > this.resetTimeout) {
        logger.info(`Circuit breaker reset for ${this.name}`, {
          context: { timeElapsed: now - this.lastFailureTime }
        });
        this.reset();
        return false;
      }
      return true;
    }
    return false;
  }

  private reset(): void {
    if (this.failures > 0) {
      logger.debug(`Circuit breaker reset for ${this.name}`);
    }
    this.failures = 0;
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
  }

  getStatus(): {
    isOpen: boolean;
    failures: number;
    lastFailureTime: number;
  } {
    return {
      isOpen: this.isOpen(),
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
} 