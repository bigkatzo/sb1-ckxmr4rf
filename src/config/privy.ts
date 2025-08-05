import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { mainnet, polygon, arbitrum, base } from 'viem/chains';

export const PRIVY_CONFIG = {
  appId: import.meta.env.VITE_PRIVY_APP_ID || '',
  config: {
    loginMethods: ['wallet'] as ('wallet')[],
    appearance: {
      theme: 'dark' as const,
      accentColor: '#0F47E4' as `#${string}`,
      showWalletLoginFirst: true,
      // Prioritize Solana wallets in the UI
      walletChainType: 'solana' as const,
    },
    // EVM chain configuration (but not set as default)
    supportedChains: [
      mainnet,
      polygon,
      arbitrum, 
      base,
    ],
    // Remove defaultChain to prevent auto-connecting to Ethereum
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
    embeddedWallets: {
      createOnLogin: 'users-without-wallets' as const,
      noPromptOnSignature: true,
    },
    externalWallets: {
      // Solana configuration
      solana: {
        connectors: toSolanaWalletConnectors()
      }
    },
  },
};

// Validate configuration
if (!PRIVY_CONFIG.appId) {
  console.warn('⚠️ VITE_PRIVY_APP_ID is not set. Privy authentication will not work.');
}

if (!PRIVY_CONFIG.config.walletConnectProjectId) {
  console.warn('⚠️ VITE_WALLETCONNECT_PROJECT_ID is not set. WalletConnect may not work properly.');
}