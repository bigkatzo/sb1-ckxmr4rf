/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The Supabase project URL
   * @example https://your-project.supabase.co
   */
  readonly VITE_SUPABASE_URL: string

  /**
   * The Supabase anonymous key (public)
   * This key is safe to expose in the client as it has limited permissions
   */
  readonly VITE_SUPABASE_ANON_KEY: string

  /**
   * The Alchemy API key for Solana RPC access
   */
  readonly VITE_ALCHEMY_API_KEY: string

  /**
   * The Helius API key for Solana RPC access
   */
  readonly VITE_HELIUS_API_KEY: string

  /**
   * The WalletConnect project ID for mobile wallet support
   * Get one at https://cloud.walletconnect.com/
   */
  readonly VITE_WALLETCONNECT_PROJECT_ID: string

  /**
   * The API base URL for the application
   * @example https://store.fun
   */
  readonly VITE_API_URL: string

  /**
   * The Stripe publishable key for payment processing
   * @example pk_test_...
   */
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string

  /**
   * The Privy App ID for embedded wallet functionality
   */
  readonly VITE_PRIVY_APP_ID: string

  /**
   * The 17Track API key for package tracking
   */
  readonly VITE_SEVENTEEN_TRACK_API_KEY: string

  /**
   * The QuickNode API key for Solana RPC access
   */
  readonly VITE_QUICKNODE_API_KEY: string

  /**
   * The cache WebSocket URL for real-time updates
   */
  readonly VITE_CACHE_WEBSOCKET_URL: string

  /**
   * Whether we're running in development mode
   */
  readonly DEV: boolean

  /**
   * Whether we're running in production mode
   */
  readonly PROD: boolean

  /**
   * The current mode (development, production, etc)
   */
  readonly MODE: string

  /**
   * The base URL where the app is being served
   */
  readonly BASE_URL: string

  /**
   * The Node.js environment (development, production, etc)
   */
  readonly NODE_ENV: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  solana?: {
    connect: () => Promise<{ publicKey: string }>;
    disconnect: () => Promise<void>;
    signAndSendTransaction: (transaction: any) => Promise<{ signature: string }>;
    signTransaction: (transaction: any) => Promise<any>;
    signAllTransactions: (transactions: any[]) => Promise<any[]>;
    request: (params: any) => Promise<any>;
  }
}