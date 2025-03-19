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
   * Whether we're running in development mode
   */
  readonly DEV: boolean

  /**
   * The current mode (development, production, etc)
   */
  readonly MODE: string

  /**
   * The base URL where the app is being served
   */
  readonly BASE_URL: string
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