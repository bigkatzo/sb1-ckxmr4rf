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
  
  private state$ = new BehaviorSubject<ConnectionState>({
    status: 'connecting',
    lastHealthCheck: Date.now(),
    error: null
  });

  private activeChannels = new Map<string, RealtimeChannel>();
  private channelConfigs = new Map<string, RealtimeChannelOptions>();
  
  private constructor(private supabase: SupabaseClient) {
    this.startHealthCheck();
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
      // Disconnect current realtime connection
      await (this.supabase.realtime as any)?.disconnect();
      
      // Small delay before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reconnect realtime
      await (this.supabase.realtime as any)?.connect();
      
      // Resubscribe all channels
      this.activeChannels.forEach((_, name) => {
        const config = this.channelConfigs.get(name) || { config: {} };
        this.createChannel(name, config);
      });
      
      this.reconnectAttempts = 0;
      this.updateState({ status: 'connected', error: null });
    } catch (error) {
      console.error('Failed to reconnect:', error);
      this.handleReconnectError(error as Error);
    }
  }

  private startHealthCheck() {
    this.checkHealth();
    this.intervalId = setInterval(() => this.checkHealth(), this.healthCheckInterval);
  }

  private async checkHealth() {
    try {
      const transport = (this.supabase.realtime as any)?.transport;
      const isConnected = transport?.connectionState === 'open';
      
      this.updateState({
        status: isConnected ? 'connected' : 'disconnected',
        lastHealthCheck: Date.now(),
        error: null
      });

      if (!isConnected && this.state$.value.status === 'connected') {
        await this.handleDisconnection();
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