import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

export const PRIVY_CONFIG = {
  appId: import.meta.env.VITE_PRIVY_APP_ID || '',
  config: {
    loginMethods: ['wallet'] as ('wallet')[], // Remove email to focus on wallet connections
    appearance: {
      theme: 'dark' as const,
      accentColor: '#0F47E4' as `#${string}`,
      showWalletLoginFirst: true,
      walletChainType: 'solana' as const, // Solana only
    },
    // Use Solana as default chain for Solana wallet compatibility
    defaultChain: {
      id: 1399811150, // Solana mainnet chain ID for Privy
      name: 'Solana',
      rpcUrls: {
        default: { http: ['https://api.mainnet-beta.solana.com'] },
        public: { http: ['https://api.mainnet-beta.solana.com'] }
      },
      blockExplorers: {
        default: { name: 'Solscan', url: 'https://solscan.io' }
      },
      nativeCurrency: {
        name: 'SOL',
        symbol: 'SOL',
        decimals: 9,
      },
    },
    supportedChains: [
      // Solana ONLY - remove all EVM chains to prevent confusion
      {
        id: 1399811150, // Correct Solana mainnet chain ID for Privy
        name: 'Solana',
        rpcUrls: {
          default: { http: ['https://api.mainnet-beta.solana.com'] },
          public: { http: ['https://api.mainnet-beta.solana.com'] }
        },
        blockExplorers: {
          default: { name: 'Solscan', url: 'https://solscan.io' }
        },
        nativeCurrency: {
          name: 'SOL',
          symbol: 'SOL',
          decimals: 9,
        },
      },
    ],
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
    embeddedWallets: {
      createOnLogin: 'users-without-wallets' as const,
      noPromptOnSignature: true,
    },
    externalWallets: {
      solana: {
        connectors: toSolanaWalletConnectors()
      }
    },
    // Prioritize Phantom for Solana - make it the first option
    defaultWallet: 'phantom' as const,
    supportedWallets: [
      {
        id: 'phantom',
        name: 'Phantom',
        icon: 'https://phantom.app/img/phantom-logo.svg',
        url: 'https://phantom.app',
        chromeUrl: 'https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa',
        firefoxUrl: 'https://addons.mozilla.org/en-US/firefox/addon/phantom-app/',
        mobileUrl: 'https://phantom.app/ul/browse/',
        priority: 1, // Highest priority
      },
      {
        id: 'solflare',
        name: 'Solflare',
        icon: 'https://solflare.com/assets/logo.svg',
        url: 'https://solflare.com',
        chromeUrl: 'https://chrome.google.com/webstore/detail/solflare-wallet/bhhhlbepdkbapadjdnnojkbgioiodbic',
        mobileUrl: 'https://solflare.com/ul/browse/',
        priority: 2,
      },
      {
        id: 'backpack',
        name: 'Backpack',
        icon: 'https://backpack.app/assets/logo.svg',
        url: 'https://backpack.app',
        chromeUrl: 'https://chrome.google.com/webstore/detail/backpack/aflkmfhebedbjioipglgcbcmnbpgliof',
        mobileUrl: 'https://backpack.app/ul/browse/',
        priority: 3,
      },
    ],
  },
  // Add privyWalletOverride at the root level with Phantom priority
  privyWalletOverride: {
    // Default wallet configuration
    defaultWallet: 'phantom' as const,
    supportedWallets: [
      {
        id: 'phantom',
        name: 'Phantom',
        icon: 'https://phantom.app/img/phantom-logo.svg',
        url: 'https://phantom.app',
        chromeUrl: 'https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa',
        firefoxUrl: 'https://addons.mozilla.org/en-US/firefox/addon/phantom-app/',
        mobileUrl: 'https://phantom.app/ul/browse/',
        priority: 1,
      },
      {
        id: 'solflare',
        name: 'Solflare',
        icon: 'https://solflare.com/assets/logo.svg',
        url: 'https://solflare.com',
        chromeUrl: 'https://chrome.google.com/webstore/detail/solflare-wallet/bhhhlbepdkbapadjdnnojkbgioiodbic',
        mobileUrl: 'https://solflare.com/ul/browse/',
        priority: 2,
      },
      {
        id: 'backpack',
        name: 'Backpack',
        icon: 'https://backpack.app/assets/logo.svg',
        url: 'https://backpack.app',
        chromeUrl: 'https://chrome.google.com/webstore/detail/backpack/aflkmfhebedbjioipglgcbcmnbpgliof',
        mobileUrl: 'https://backpack.app/ul/browse/',
        priority: 3,
      },
    ],
  },
};

// Validate configuration
if (!PRIVY_CONFIG.appId) {
  console.warn('⚠️ VITE_PRIVY_APP_ID is not set. Privy authentication will not work.');
}

if (!PRIVY_CONFIG.config.walletConnectProjectId) {
  console.warn('⚠️ VITE_WALLETCONNECT_PROJECT_ID is not set. WalletConnect may not work properly.');
} 