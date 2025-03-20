import { RealtimeChannel, SupabaseClient, RealtimeChannelOptions } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { MessageBatcher, BatchedMessage } from './MessageBatcher';
import { PayloadCompressor } from './PayloadCompressor';
import { RateLimiter } from './RateLimiter';
import { logger } from './logger';

interface CompressedPayload<T> {
  compressed: boolean;
  data: T | Uint8Array;
}

export type ConnectionState = {
  status: 'connected' | 'connecting' | 'disconnected';
  lastHealthCheck: number;
  error: Error | null;
};

export class ConnectionManager {
  private static instance: ConnectionManager;
  private healthCheckInterval: number = 30000;
  private maxReconnectAttempts: number = 5;
  private reconnectAttempts: number = 0;
  private intervalId?: NodeJS.Timeout;
  private backoffDelay: number = 2000;
  private transportInitDelay: number = 500;
  private isInitializingTransport = false;
  private reconnectTimeout?: NodeJS.Timeout;
  private isHealthCheckStarted = false;
  private deferredChannels = new Map<string, {
    name: string,
    config: RealtimeChannelOptions,
    priority: number
  }>();
  
  private state$ = new BehaviorSubject<ConnectionState>({
    status: 'connecting',
    lastHealthCheck: Date.now(),
    error: null
  });

  private channels: Map<string, RealtimeChannel> = new Map();
  private channelConfigs = new Map<string, RealtimeChannelOptions>();
  
  private messageBatcher: MessageBatcher;
  private payloadCompressor: PayloadCompressor;
  private rateLimiter: RateLimiter;
  
  private constructor(private supabase: SupabaseClient) {
    this.messageBatcher = MessageBatcher.getInstance();
    this.payloadCompressor = PayloadCompressor.getInstance();
    this.rateLimiter = RateLimiter.getInstance();
  }

  static getInstance(supabase: SupabaseClient): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager(supabase);
    }
    return ConnectionManager.instance;
  }

  /**
   * Initialize the connection manager with deferred loading
   */
  public async initialize(options: {
    immediate?: boolean;
    startHealthCheck?: boolean;
  } = {}) {
    const { immediate = false, startHealthCheck = false } = options;

    if (immediate) {
      await this.initializeConnection();
    }

    if (startHealthCheck && !this.isHealthCheckStarted) {
      this.startHealthCheck();
      this.isHealthCheckStarted = true;
    }
  }

  /**
   * Get an observable of the connection state
   */
  public getState() {
    return this.state$.asObservable();
  }

  /**
   * Create a new channel with priority-based initialization
   */
  public async createChannel(
    channelName: string, 
    config: RealtimeChannelOptions = { config: {} },
    priority: number = 0
  ): Promise<RealtimeChannel> {
    // Apply rate limiting
    await this.rateLimiter.waitForToken(channelName, 'subscription');

    // For high-priority channels, create immediately
    if (priority > 0) {
      return this.createChannelImmediate(channelName, config);
    }

    // For low-priority channels, defer creation
    this.deferredChannels.set(channelName, {
      name: channelName,
      config,
      priority
    });

    // Setup message batching for this channel
    this.setupMessageBatching(channelName);

    // Return a placeholder channel
    const deferredChannel = this.supabase.channel(channelName, config);
    this.channels.set(channelName, deferredChannel);
    
    return deferredChannel;
  }

  /**
   * Create a channel immediately without deferring
   */
  private createChannelImmediate(
    channelName: string,
    config: RealtimeChannelOptions
  ): RealtimeChannel {
    // Remove any existing channel
    this.removeChannel(channelName);

    // Store config for reconnection
    this.channelConfigs.set(channelName, config);

    const channel = this.supabase.channel(channelName, config);

    channel
      .on('broadcast', { event: 'batch' }, (payload) => {
        this.handleMessage(channelName, payload);
      })
      .subscribe((status: string) => {
        console.debug(`Channel ${channelName} status:`, status);
        
        if (status === 'SUBSCRIBED') {
          this.reconnectAttempts = 0;
          this.deferredChannels.delete(channelName); // Channel is now active
        } else if (status === 'CHANNEL_ERROR') {
          this.handleChannelError(channel);
        }
      });

    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Initialize deferred channels based on priority
   */
  public async initializeDeferredChannels(minPriority: number = 0) {
    // Sort channels by priority
    const sortedChannels = Array.from(this.deferredChannels.entries())
      .sort((a, b) => b[1].priority - a[1].priority)
      .filter(([_, config]) => config.priority >= minPriority);

    // Initialize channels in sequence with delay
    for (const [name, config] of sortedChannels) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Stagger initialization
      this.createChannelImmediate(name, config.config);
    }
  }

  /**
   * Remove a channel and clean up its resources
   */
  public removeChannel(channelName: string) {
    const existingChannel = this.channels.get(channelName);
    if (existingChannel) {
      existingChannel.unsubscribe();
      this.channels.delete(channelName);
      this.channelConfigs.delete(channelName);
    }
  }

  /**
   * Force reconnection of all channels
   */
  public async reconnectAll() {
    console.debug('Reconnecting all channels...');
    
    try {
      await this.initializeConnection();
      
      // Only resubscribe channels if connection is successful
      if (this.state$.value.status === 'connected') {
        // Resubscribe all channels
        this.channels.forEach((_, name) => {
          const config = this.channelConfigs.get(name) || { config: {} };
          this.createChannel(name, config);
        });
        
        this.reconnectAttempts = 0;
      }
    } catch (error) {
      console.error('Failed to reconnect:', error);
      this.handleReconnectError(error as Error);
    }
  }

  private calculateBackoff(): number {
    const baseDelay = this.backoffDelay;
    const maxDelay = 30000; // Cap at 30 seconds
    const attempt = Math.min(this.reconnectAttempts, 10); // Cap exponential growth
    
    // Calculate exponential backoff with jitter
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(2, attempt),
      maxDelay
    );
    
    // Add random jitter (±25% of delay)
    const jitter = exponentialDelay * 0.5 * Math.random() - exponentialDelay * 0.25;
    return exponentialDelay + jitter;
  }

  private async initializeConnection() {
    try {
      await this.initializeTransport();
      
      // Only proceed with channel setup if transport is ready
      if (this.supabase.realtime.transport) {
        this.updateState({ status: 'connected', error: null });
        this.reconnectAttempts = 0;
        this.notifyListeners('connected');
      } else {
        throw new Error('Transport not ready after initialization');
      }
    } catch (error) {
      console.error('Failed to initialize connection:', error);
      this.updateState({
        status: 'disconnected',
        error: error as Error
      });
      this.handleConnectionError(error as Error);
    }
  }

  private async initializeTransport(): Promise<void> {
    if (this.isInitializingTransport) {
      return;
    }

    this.isInitializingTransport = true;
    try {
      // Add delay before attempting transport initialization
      await new Promise(resolve => setTimeout(resolve, this.transportInitDelay));
      
      if (!this.supabase.realtime.transport) {
        console.log('Realtime transport not available, attempting to initialize it');
        await this.supabase.realtime.connect();
      }

      if (!this.supabase.realtime.transport) {
        throw new Error('Failed to initialize transport after attempt');
      }

      this.isInitializingTransport = false;
    } catch (error) {
      this.isInitializingTransport = false;
      console.error('Transport initialization failed:', error);
      throw error;
    }
  }

  private startHealthCheck() {
    if (this.isHealthCheckStarted) return;
    
    this.checkHealth();
    this.intervalId = setInterval(() => this.checkHealth(), this.healthCheckInterval);
    this.isHealthCheckStarted = true;
  }

  private async checkHealth() {
    try {
      const realtimeClient = this.supabase.realtime as any;
      const transport = realtimeClient?.transport;
      const isConnected = transport?.connectionState === 'open';
      
      // Add additional health checks
      const isHealthy = isConnected && this.channels.size > 0 && 
        Array.from(this.channels.values()).some(channel => channel.state === 'joined');
      
      // Update state based on current connection status
      this.updateState({
        status: isHealthy ? 'connected' : 'disconnected',
        lastHealthCheck: Date.now(),
        error: null
      });

      // If disconnected but was previously connected, attempt recovery
      if (!isHealthy && this.state$.value.status === 'connected') {
        await this.handleDisconnection();
      }

      // Send heartbeat if connected
      if (isConnected) {
        try {
          await realtimeClient.send({
            topic: 'phoenix',
            event: 'heartbeat',
            payload: {},
            ref: Date.now().toString()
          });
        } catch (error) {
          console.warn('Failed to send heartbeat:', error);
          await this.handleDisconnection();
        }
      }
    } catch (error) {
      console.error('Health check failed:', error);
      this.updateState({
        status: 'disconnected',
        error: error as Error
      });
    }
  }

  private async handleDisconnection() {
    console.debug('Connection lost, attempting to recover...');
    
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.updateState({ status: 'connecting' });
      
      const delay = Math.min(this.backoffDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
      console.log(`Attempting reconnection in ${Math.round(delay/1000)} seconds...`);
      
      this.reconnectTimeout = setTimeout(async () => {
        try {
          await this.reconnectAll();
          // Reset attempts on successful reconnection
          if (this.state$.value.status === 'connected') {
            this.reconnectAttempts = 0;
          }
        } catch (error) {
          console.error('Reconnection attempt failed:', error);
        }
      }, delay);
    } else {
      this.updateState({
        status: 'disconnected',
        error: new Error('Max reconnection attempts reached')
      });
      // Notify all channels to switch to polling
      this.notifyListeners('max_retries_reached');
    }
  }

  private handleChannelError(channel: RealtimeChannel) {
    return () => {
      console.error(`Channel error for ${channel.topic}`);
      this.removeChannel(channel.topic);
    };
  }

  private handleReconnectError(error: Error) {
    this.reconnectAttempts++;
    this.updateState({
      status: 'disconnected',
      error
    });
  }

  private updateState(partial: Partial<ConnectionState>) {
    this.state$.next({
      ...this.state$.value,
      ...partial,
      lastHealthCheck: Date.now()
    });
  }

  public cleanup() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.channels.forEach(channel => channel.unsubscribe());
    this.channels.clear();
    this.channelConfigs.clear();
    this.deferredChannels.clear();
    this.isHealthCheckStarted = false;
  }

  private handleConnectionError(error: Error): void {
    console.error('Connection error:', error);
    this.updateState({
      status: 'disconnected',
      error
    });
    this.notifyListeners('error', error);

    // Calculate next retry delay with jitter
    const delay = this.calculateBackoff();
    console.log(`Will retry in approximately ${Math.round(delay/1000)} seconds (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => this.reconnectAll(), delay);
    } else {
      console.log('Max reconnection attempts reached, switching to polling fallback');
      this.notifyListeners('max_retries_reached');
    }
  }

  private notifyListeners(event: string, data?: any) {
    // Emit event to any registered listeners
    switch (event) {
      case 'connected':
        console.log('Connection established');
        break;
      case 'error':
        console.error('Connection error:', data);
        break;
      case 'max_retries_reached':
        console.warn('Max reconnection attempts reached');
        break;
      default:
        console.debug('Connection event:', event, data);
    }
  }

  private setupMessageBatching(channelName: string): void {
    // Subscribe to batched messages
    this.messageBatcher.subscribe(channelName, async (messages) => {
      try {
        // Check if payload needs compression
        const payload: CompressedPayload<{ messages: BatchedMessage[] }> = {
          compressed: false,
          data: { messages }
        };

        if (this.payloadCompressor.shouldCompress(payload.data)) {
          const compressed = await this.payloadCompressor.compressAsync(payload.data);
          payload.compressed = true;
          payload.data = compressed;
        }

        // Send the payload through the channel
        const channel = this.channels.get(channelName);
        if (channel) {
          await this.rateLimiter.waitForToken(channelName);
          channel.send({
            type: 'broadcast',
            event: 'batch',
            payload
          });
        }
      } catch (error) {
        logger.error('Error processing batched messages', {
          context: { channelName, error }
        });
      }
    });
  }

  private async handleMessage(channelName: string, message: any): Promise<void> {
    try {
      // Check if message is compressed
      if (message.compressed) {
        message.data = await this.payloadCompressor.decompressAsync(message.data);
      }

      // Add to batch queue
      this.messageBatcher.addMessage(channelName, {
        table: message.table,
        operation: message.type,
        payload: message.payload
      });
    } catch (error) {
      logger.error('Error handling message', {
        context: { channelName, error }
      });
    }
  }
} 