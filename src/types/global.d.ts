/// <reference types="vite/client" />
/// <reference types="node" />

import type { Database } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    FormData: typeof FormData;
    phantom?: {
      solana?: {
        isPhantom?: boolean;
        connect?: () => Promise<{ publicKey: string }>;
        disconnect?: () => Promise<void>;
      };
    };
  }

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      VITE_SUPABASE_URL: string;
      VITE_SUPABASE_ANON_KEY: string;
      [key: string]: string | undefined;
    }
  }

  type SupabaseClientType = SupabaseClient<Database>;
}

export {}; 