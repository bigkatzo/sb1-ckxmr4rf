/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The Supabase project URL
   * @example https://your-project.supabase.co
   */
  readonly VITE_SUPABASE_URL: string;

  /**
   * The Supabase anonymous key (public)
   * This key is safe to expose in the client as it has limited permissions
   */
  readonly VITE_SUPABASE_ANON_KEY: string;

  /**
   * The Alchemy API key for Solana RPC access
   */
  readonly VITE_ALCHEMY_API_KEY: string;

  /**
   * Whether we're running in development mode
   */
  readonly DEV: boolean;

  /**
   * The current mode (development, production, etc)
   */
  readonly MODE: string;

  /**
   * The base URL where the app is being served
   */
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Prevent auto-completion of non-prefixed env vars
type EnvVar = keyof ImportMetaEnv;
declare namespace NodeJS {
  interface ProcessEnv extends Record<EnvVar, string> {}
} 