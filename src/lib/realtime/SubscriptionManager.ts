import { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from './logger';

export interface SubscriptionMetadata {
  lastAccessed: number;
  priority: number;
  isVisible: boolean;
  retryCount: number;
  status: 'active' | 'stale' | 'error';
  cleanup: () => void;
}

const CLEANUP_TIMEOUTS = {
  INACTIVE: 5 * 60 * 1000,  // 5 minutes
  ERRORED: 30 * 1000,       // 30 seconds
  STALE: 10 * 60 * 1000     // 10 minutes
};

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private subscriptions = new Map<string, SubscriptionMetadata>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_CHECK_INTERVAL = 60000; // 1 minute

  private constructor() {
    this.startCleanupInterval();
  }

  static getInstance(): SubscriptionManager {
    if (!this.instance) {
      this.instance = new SubscriptionManager();
    }
    return this.instance;
  }

  registerSubscription(
    channelKey: string, 
    cleanup: () => void,
    priority: number = 0
  ): void {
    this.subscriptions.set(channelKey, {
      lastAccessed: Date.now(),
      priority,
      isVisible: false,
      retryCount: 0,
      status: 'active',
      cleanup
    });
    
    logger.debug(`Registered subscription: ${channelKey}`, {
      context: { priority, totalActive: this.subscriptions.size }
    });
  }

  updateAccessTime(channelKey: string): void {
    const sub = this.subscriptions.get(channelKey);
    if (sub) {
      sub.lastAccessed = Date.now();
      if (sub.status === 'stale') {
        sub.status = 'active';
      }
    }
  }

  markVisible(channelKey: string, isVisible: boolean): void {
    const sub = this.subscriptions.get(channelKey);
    if (sub) {
      sub.isVisible = isVisible;
      // Reset retry count when becoming visible
      if (isVisible) {
        sub.retryCount = 0;
      }
      logger.debug(`Visibility changed for ${channelKey}`, {
        context: { isVisible }
      });
    }
  }

  markError(channelKey: string): void {
    const sub = this.subscriptions.get(channelKey);
    if (sub) {
      sub.status = 'error';
      sub.retryCount++;
      logger.warn(`Subscription error for ${channelKey}`, {
        context: { retryCount: sub.retryCount }
      });
    }
  }

  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSubscriptions();
    }, this.CLEANUP_CHECK_INTERVAL);
  }

  private cleanupStaleSubscriptions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, metadata] of this.subscriptions.entries()) {
      const timeSinceAccess = now - metadata.lastAccessed;
      let shouldCleanup = false;

      // Cleanup conditions
      if (metadata.status === 'error' && timeSinceAccess > CLEANUP_TIMEOUTS.ERRORED) {
        shouldCleanup = true;
      } else if (!metadata.isVisible && timeSinceAccess > CLEANUP_TIMEOUTS.INACTIVE) {
        shouldCleanup = true;
      } else if (timeSinceAccess > CLEANUP_TIMEOUTS.STALE) {
        metadata.status = 'stale';
      }

      if (shouldCleanup) {
        try {
          metadata.cleanup();
          this.subscriptions.delete(key);
          cleanedCount++;
          logger.info(`Cleaned up subscription: ${key}`, {
            context: { reason: metadata.status }
          });
        } catch (error) {
          logger.error(`Error cleaning up subscription: ${key}`, {
            context: { error }
          });
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleanup complete`, {
        context: {
          cleaned: cleanedCount,
          remaining: this.subscriptions.size
        }
      });
    }
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.entries())
      .filter(([_, meta]) => meta.status === 'active')
      .map(([key]) => key);
  }

  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const [key, metadata] of this.subscriptions.entries()) {
      try {
        metadata.cleanup();
        this.subscriptions.delete(key);
      } catch (error) {
        logger.error(`Error during final cleanup: ${key}`, {
          context: { error }
        });
      }
    }

    logger.info('Subscription manager cleaned up');
  }
} 