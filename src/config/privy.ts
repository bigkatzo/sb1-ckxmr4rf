import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

export const PRIVY_CONFIG = {
  appId: import.meta.env.VITE_PRIVY_APP_ID || '',
  config: {
    loginMethods: ['wallet'] as ('wallet')[],
    appearance: {
      theme: 'dark' as const,
      accentColor: '#0F47E4' as `#${string}`,
      showWalletLoginFirst: true,
      // Force Solana-only to prevent MetaMask prompts
      walletChainType: 'solana-only' as const,
    },
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
    embeddedWallets: {
      createOnLogin: 'users-without-wallets' as const,
      noPromptOnSignature: true,
    },
    externalWallets: {
      // Solana configuration with explicit wallet prioritization
      solana: {
        connectors: toSolanaWalletConnectors()
      }
    },
    // Add mobile-specific settings
    mobile: {
      // Enable mobile wallet detection
      walletDetection: true,
      // Enable deep linking for mobile wallets
      deepLinking: true,
    }
  },
};

// Validate configuration
if (!PRIVY_CONFIG.appId) {
  console.warn('⚠️ VITE_PRIVY_APP_ID is not set. Privy authentication will not work.');
}

if (!PRIVY_CONFIG.config.walletConnectProjectId) {
  console.warn('⚠️ VITE_WALLETCONNECT_PROJECT_ID is not set. WalletConnect may not work properly.');
}