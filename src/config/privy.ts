import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

export const PRIVY_CONFIG = {
  appId: import.meta.env.VITE_PRIVY_APP_ID || '',
  config: {
    // Enable multiple login methods including social logins and embedded wallets
    loginMethods: [
      'wallet',
      'email',
      'twitter',
      'google'
    ] as ('wallet' | 'email' | 'twitter' | 'google')[],
    appearance: {
      theme: 'dark' as const,
      accentColor: '#0F47E4' as `#${string}`,
      showWalletLoginFirst: true,
      // Force Solana-only to prevent MetaMask prompts
      walletChainType: 'solana-only' as const,
    },
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
    embeddedWallets: {
      // Create embedded wallets for users who sign in with social logins
      createOnLogin: 'users-without-wallets' as const,
      // Don't prompt for signature to improve UX
      noPromptOnSignature: true,
      // Explicitly set to Solana chain
      chainId: 'solana' as const,
      // Require email verification for embedded wallets
      requireEmailVerification: true,
    },
    externalWallets: {
      // Solana configuration with explicit wallet prioritization
      solana: {
        connectors: toSolanaWalletConnectors()
      }
    },
    // Enhanced mobile-specific settings for TWA
    mobile: {
      // Enable mobile wallet detection
      walletDetection: true,
      // Enable deep linking for mobile wallets
      deepLinking: true,
      // Enable TWA-specific features
      twaSupport: true,
    },
    // Add TWA-specific configuration
    twa: {
      // Enable TWA wallet detection
      enableWalletDetection: true,
      // Enable TWA-specific deep linking
      enableDeepLinking: true,
      // Enable TWA-specific wallet injection
      enableWalletInjection: true,
    },
    // Social login configuration
    socialLogins: {
      // Enable Twitter/X login
      twitter: {
        enabled: true,
        // Require email for embedded wallet creation
        requireEmail: true,
      },
      // Enable Google/Gmail login
      google: {
        enabled: true,
        // Require email for embedded wallet creation
        requireEmail: true,
      },
      // Enable email-only login for embedded wallets
      email: {
        enabled: true,
        // Require email verification
        requireVerification: true,
      }
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

// Log configuration for debugging
console.log('Privy Configuration:', {
  appId: PRIVY_CONFIG.appId ? 'Set' : 'Not Set',
  walletConnectProjectId: PRIVY_CONFIG.config.walletConnectProjectId ? 'Set' : 'Not Set',
  walletChainType: PRIVY_CONFIG.config.appearance.walletChainType,
  loginMethods: PRIVY_CONFIG.config.loginMethods,
  embeddedWallets: PRIVY_CONFIG.config.embeddedWallets,
  mobile: PRIVY_CONFIG.config.mobile,
  twa: PRIVY_CONFIG.config.twa,
  socialLogins: PRIVY_CONFIG.config.socialLogins
});