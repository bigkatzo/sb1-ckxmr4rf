import { RealtimeChannel, SupabaseClient, RealtimeChannelOptions } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';

export type ConnectionState = {
  status: 'connected' | 'connecting' | 'disconnected';
  lastHealthCheck: number;
  error: Error | null;
};

export class ConnectionManager {
  private static instance: ConnectionManager;
  private healthCheckInterval: number = 15000; // 15 seconds
  private maxReconnectAttempts: number = 5;
  private reconnectAttempts: number = 0;
  private intervalId?: NodeJS.Timeout;
  private connectionTimeout: number = 10000; // 10 seconds timeout
  private backoffDelay: number = 5000; // Base delay for exponential backoff
  
  private state$ = new BehaviorSubject<ConnectionState>({
    status: 'connecting',
    lastHealthCheck: Date.now(),
    error: null
  });

  private activeChannels = new Map<string, RealtimeChannel>();
  private channelConfigs = new Map<string, RealtimeChannelOptions>();
  
  private constructor(private supabase: SupabaseClient) {
    this.initializeConnection().then(() => {
      this.startHealthCheck();
    });
  }

  static getInstance(supabase: SupabaseClient): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager(supabase);
    }
    return ConnectionManager.instance;
  }

  /**
   * Get an observable of the connection state
   */
  public getState() {
    return this.state$.asObservable();
  }

  /**
   * Create a new channel with automatic recovery
   */
  public createChannel(channelName: string, config: RealtimeChannelOptions = { config: {} }): RealtimeChannel {
    // Remove any existing channel with the same name
    this.removeChannel(channelName);

    // Store the config for reconnection
    this.channelConfigs.set(channelName, config);

    const channel = this.supabase.channel(channelName, config);

    channel.subscribe((status: string) => {
      console.debug(`Channel ${channelName} status:`, status);
      
      if (status === 'SUBSCRIBED') {
        this.reconnectAttempts = 0;
      } else if (status === 'CHANNEL_ERROR') {
        this.handleChannelError(channelName, channel);
      }
    });

    this.activeChannels.set(channelName, channel);
    return channel;
  }

  /**
   * Remove a channel and clean up its resources
   */
  public removeChannel(channelName: string) {
    const existingChannel = this.activeChannels.get(channelName);
    if (existingChannel) {
      existingChannel.unsubscribe();
      this.activeChannels.delete(channelName);
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
        this.activeChannels.forEach((_, name) => {
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

  private calculateBackoff(attempt: number): number {
    const jitter = 0.5 + Math.random(); // Random between 0.5 and 1.5
    const delay = Math.min(
      this.backoffDelay * Math.pow(2, attempt) * jitter,
      60000 // Cap at 60 seconds
    );
    return delay;
  }

  private async initializeConnection() {
    try {
      const realtimeClient = this.supabase.realtime as any;
      
      // Ensure clean slate by disconnecting first
      if (realtimeClient?.transport) {
        await realtimeClient.disconnect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Initialize connection with timeout and retry
      let connected = false;
      let attempts = 0;
      
      while (!connected && attempts < this.maxReconnectAttempts) {
        try {
          await Promise.race([
            realtimeClient.connect(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout)
            )
          ]);

          // Wait for transport to be fully initialized
          await new Promise(resolve => setTimeout(resolve, 3000));

          if (realtimeClient.transport?.connectionState === 'open') {
            connected = true;
            this.reconnectAttempts = 0;
            this.updateState({ status: 'connected', error: null });
            break;
          }
        } catch (error) {
          attempts++;
          console.warn(`Connection attempt ${attempts} failed:`, error);
          
          if (attempts < this.maxReconnectAttempts) {
            const delay = this.calculateBackoff(attempts);
            console.log(`Retrying in ${Math.round(delay/1000)} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!connected) {
        throw new Error('Failed to establish connection after maximum attempts');
      }
    } catch (error) {
      console.error('Failed to initialize connection:', error);
      this.updateState({
        status: 'disconnected',
        error: error as Error
      });
    }
  }

  private startHealthCheck() {
    this.checkHealth();
    this.intervalId = setInterval(() => this.checkHealth(), this.healthCheckInterval);
  }

  private async checkHealth() {
    try {
      const realtimeClient = this.supabase.realtime as any;
      const transport = realtimeClient?.transport;
      const isConnected = transport?.connectionState === 'open';
      
      // Update state based on current connection status
      this.updateState({
        status: isConnected ? 'connected' : 'disconnected',
        lastHealthCheck: Date.now(),
        error: null
      });

      // If disconnected but was previously connected, attempt recovery
      if (!isConnected && this.state$.value.status === 'connected') {
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
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.updateState({ status: 'connecting' });
      
      const delay = this.calculateBackoff(this.reconnectAttempts);
      console.log(`Attempting reconnection in ${Math.round(delay/1000)} seconds...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      await this.reconnectAll();
    } else {
      this.updateState({
        status: 'disconnected',
        error: new Error('Max reconnection attempts reached')
      });
    }
  }

  private handleChannelError(channelName: string, _channel: RealtimeChannel) {
    console.warn(`Channel ${channelName} encountered an error`);
    
    // Remove and recreate the channel with stored config
    this.removeChannel(channelName);
    const config = this.channelConfigs.get(channelName) || { config: {} };
    this.createChannel(channelName, config);
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
    this.activeChannels.forEach(channel => channel.unsubscribe());
    this.activeChannels.clear();
    this.channelConfigs.clear();
  }
} 