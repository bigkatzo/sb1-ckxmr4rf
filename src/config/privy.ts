import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

export const PRIVY_CONFIG = {
  appId: import.meta.env.VITE_PRIVY_APP_ID || '',
  config: {
    loginMethods: ['wallet'] as ('wallet')[], // Remove email to focus on wallet connections
    appearance: {
      theme: 'dark' as const,
      accentColor: '#0F47E4' as `#${string}`,
      showWalletLoginFirst: true,
      walletChainType: 'solana' as const, // Change to solana only
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
      // Solana (Primary for Solana wallets like Phantom)
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
      // Ethereum (Secondary for EVM wallet compatibility)
      {
        id: 1,
        name: 'Ethereum',
        rpcUrls: {
          default: { http: ['https://ethereum.publicnode.com'] },
          public: { http: ['https://ethereum.publicnode.com'] }
        },
        blockExplorers: {
          default: { name: 'Etherscan', url: 'https://etherscan.io' }
        },
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
      },
      // Polygon
      {
        id: 137,
        name: 'Polygon',
        rpcUrls: {
          default: { http: ['https://polygon-rpc.com'] },
          public: { http: ['https://polygon-rpc.com'] }
        },
        blockExplorers: {
          default: { name: 'PolygonScan', url: 'https://polygonscan.com' }
        },
        nativeCurrency: {
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18,
        },
      },
      // BSC
      {
        id: 56,
        name: 'BNB Smart Chain',
        rpcUrls: {
          default: { http: ['https://bsc-dataseed1.binance.org'] },
          public: { http: ['https://bsc-dataseed1.binance.org'] }
        },
        blockExplorers: {
          default: { name: 'BscScan', url: 'https://bscscan.com' }
        },
        nativeCurrency: {
          name: 'BNB',
          symbol: 'BNB',
          decimals: 18,
        },
      },
      // Arbitrum
      {
        id: 42161,
        name: 'Arbitrum One',
        rpcUrls: {
          default: { http: ['https://arb1.arbitrum.io/rpc'] },
          public: { http: ['https://arb1.arbitrum.io/rpc'] }
        },
        blockExplorers: {
          default: { name: 'Arbiscan', url: 'https://arbiscan.io' }
        },
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
      },
      // Optimism
      {
        id: 10,
        name: 'Optimism',
        rpcUrls: {
          default: { http: ['https://mainnet.optimism.io'] },
          public: { http: ['https://mainnet.optimism.io'] }
        },
        blockExplorers: {
          default: { name: 'Optimistic Etherscan', url: 'https://optimistic.etherscan.io' }
        },
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        },
      },
      // Base
      {
        id: 8453,
        name: 'Base',
        rpcUrls: {
          default: { http: ['https://mainnet.base.org'] },
          public: { http: ['https://mainnet.base.org'] }
        },
        blockExplorers: {
          default: { name: 'BaseScan', url: 'https://basescan.org' }
        },
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
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
    // Prioritize Phantom for Solana
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
      },
      {
        id: 'solflare',
        name: 'Solflare',
        icon: 'https://solflare.com/assets/logo.svg',
        url: 'https://solflare.com',
        chromeUrl: 'https://chrome.google.com/webstore/detail/solflare-wallet/bhhhlbepdkbapadjdnnojkbgioiodbic',
        mobileUrl: 'https://solflare.com/ul/browse/',
      },
      {
        id: 'backpack',
        name: 'Backpack',
        icon: 'https://backpack.app/assets/logo.svg',
        url: 'https://backpack.app',
        chromeUrl: 'https://chrome.google.com/webstore/detail/backpack/aflkmfhebedbjioipglgcbcmnbpgliof',
        mobileUrl: 'https://backpack.app/ul/browse/',
      },
    ],
  },
  // Add privyWalletOverride at the root level
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
      },
      {
        id: 'solflare',
        name: 'Solflare',
        icon: 'https://solflare.com/assets/logo.svg',
        url: 'https://solflare.com',
        chromeUrl: 'https://chrome.google.com/webstore/detail/solflare-wallet/bhhhlbepdkbapadjdnnojkbgioiodbic',
        mobileUrl: 'https://solflare.com/ul/browse/',
      },
      {
        id: 'backpack',
        name: 'Backpack',
        icon: 'https://backpack.app/assets/logo.svg',
        url: 'https://backpack.app',
        chromeUrl: 'https://chrome.google.com/webstore/detail/backpack/aflkmfhebedbjioipglgcbcmnbpgliof',
        mobileUrl: 'https://backpack.app/ul/browse/',
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