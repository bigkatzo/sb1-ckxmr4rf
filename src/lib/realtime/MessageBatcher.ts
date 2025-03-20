import { logger } from './logger';

export interface BatchedMessage {
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
}

export class MessageBatcher {
  private static instance: MessageBatcher;
  private batchQueues: Map<string, BatchedMessage[]> = new Map();
  private batchTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly MAX_BATCH_SIZE = 100;
  private readonly BATCH_TIMEOUT = 100; // ms
  private subscribers: Map<string, ((messages: BatchedMessage[]) => void)[]> = new Map();

  private constructor() {}

  static getInstance(): MessageBatcher {
    if (!MessageBatcher.instance) {
      MessageBatcher.instance = new MessageBatcher();
    }
    return MessageBatcher.instance;
  }

  public addMessage(key: string, message: BatchedMessage): void {
    // Get or create queue for this key
    let queue = this.batchQueues.get(key);
    if (!queue) {
      queue = [];
      this.batchQueues.set(key, queue);
    }

    // Add message to queue
    queue.push(message);

    // If queue reaches max size, flush immediately
    if (queue.length >= this.MAX_BATCH_SIZE) {
      this.flushQueue(key);
      return;
    }

    // Reset timeout for this queue
    if (this.batchTimeouts.has(key)) {
      clearTimeout(this.batchTimeouts.get(key)!);
    }

    // Set new timeout
    this.batchTimeouts.set(key, setTimeout(() => {
      this.flushQueue(key);
    }, this.BATCH_TIMEOUT));
  }

  public subscribe(key: string, callback: (messages: BatchedMessage[]) => void): () => void {
    let subs = this.subscribers.get(key);
    if (!subs) {
      subs = [];
      this.subscribers.set(key, subs);
    }
    subs.push(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        const index = subs.indexOf(callback);
        if (index > -1) {
          subs.splice(index, 1);
        }
      }
    };
  }

  private flushQueue(key: string): void {
    const queue = this.batchQueues.get(key);
    if (!queue || queue.length === 0) return;

    // Clear timeout
    if (this.batchTimeouts.has(key)) {
      clearTimeout(this.batchTimeouts.get(key)!);
      this.batchTimeouts.delete(key);
    }

    // Get subscribers for this key
    const subscribers = this.subscribers.get(key) || [];

    try {
      // Notify all subscribers
      subscribers.forEach(callback => {
        try {
          callback([...queue]);
        } catch (error) {
          logger.error('Error in batch subscriber callback', {
            context: { error }
          });
        }
      });
    } finally {
      // Clear queue
      queue.length = 0;
    }
  }

  public flushAll(): void {
    for (const key of this.batchQueues.keys()) {
      this.flushQueue(key);
    }
  }
} 