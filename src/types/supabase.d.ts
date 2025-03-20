import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  interface RealtimeChannel {
    on<T = any>(
      type: 'postgres_changes' | 'presence' | 'broadcast' | '*',
      filter: {
        event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
        schema?: string;
        table?: string;
        filter?: string;
      },
      callback: (payload: RealtimePostgresChangesPayload<T>) => void
    ): RealtimeChannel;
  }
} 