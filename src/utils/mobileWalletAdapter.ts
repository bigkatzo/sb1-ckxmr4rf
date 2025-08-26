/**
 * Mobile Wallet Adapter for TWA and mobile devices
 * Handles wallet detection and connection for mobile environments
 */

export interface MobileWalletInfo {
  name: string;
  isAvailable: boolean;
  isInstalled: boolean;
  canConnect: boolean;
  deepLinkUrl?: string;
}

export interface MobileWalletAdapterConfig {
  enableTWA: boolean;
  enableMobileDetection: boolean;
  fallbackUrls: Record<string, string>;
}

// Default configuration
const DEFAULT_CONFIG: MobileWalletAdapterConfig = {
  enableTWA: true,
  enableMobileDetection: true,
  fallbackUrls: {
    phantom: 'https://phantom.app/ul/browse/',
    solflare: 'https://solflare.com/',
    backpack: 'https://backpack.app/',
  }
};

// Wallet detection keys for different environments
const WALLET_DETECTION_KEYS = {
  phantom: [
    'phantom.solana',
    'phantom',
    'window.phantom',
    'window.phantom?.solana',
    'window.phantom?.solana?.isPhantom',
  ],
  solflare: [
    'solflare',
    'window.solflare',
    'window.solflare?.isSolflare',
  ],
  backpack: [
    'backpack',
    'window.backpack',
    'window.backpack?.isBackpack',
  ]
};

/**
 * Detect if we're in a TWA (Trusted Web Activity) environment
 * Enhanced detection for Bubblewrap TWA apps
 */
export function isTWA(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for TWA-specific indicators
  const isTWA = (
    // Check for TWA-specific user agent patterns
    navigator.userAgent.includes('TWA') ||
    navigator.userAgent.includes('wv') || // Android WebView
    navigator.userAgent.includes('Chrome/') && navigator.userAgent.includes('Mobile') && !navigator.userAgent.includes('Safari') ||
    // Check for standalone mode (PWA)
    window.matchMedia('(display-mode: standalone)').matches ||
    // Check for minimal UI mode
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // Check for fullscreen mode
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // Check for custom TWA indicator
    (window as any).__TWA__ === true ||
    // Check for Bubblewrap-specific indicators
    (window as any).__BUBBLEWRAP__ === true ||
    // Check for Trusted Web Activity specific features
    'trustedTypes' in window ||
    // Check if we're in a WebView with specific features
    (window as any).Android !== undefined ||
    // Check for specific TWA user agent patterns
    /Chrome\/\d+\.\d+\.\d+\.\d+ Mobile/.test(navigator.userAgent) ||
    // Check for specific Android WebView patterns
    /Android.*Chrome\/\d+\.\d+/.test(navigator.userAgent) && !navigator.userAgent.includes('Safari')
  );
  
  console.log('TWA Detection:', { 
    isTWA, 
    userAgent: navigator.userAgent,
    displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
    hasTrustedTypes: 'trustedTypes' in window,
    hasAndroid: (window as any).Android !== undefined
  });
  return isTWA;
}

/**
 * Detect if we're on a mobile device
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  
  const isMobile = (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768 ||
    // Additional mobile detection
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
  
  return isMobile;
}

/**
 * Enhanced wallet detection with retry mechanism for TWA environments
 */
export function detectWallets(): Record<string, MobileWalletInfo> {
  const wallets: Record<string, MobileWalletInfo> = {};
  const isTWAEnv = isTWA();
  const isMobileEnv = isMobile();
  
  // Enhanced detection for TWA environments
  const detectionDelay = isTWAEnv ? 1000 : 0; // Add delay for TWA to ensure wallet injection
  
  // Check for Phantom with enhanced detection
  const phantomAvailable = WALLET_DETECTION_KEYS.phantom.some(key => {
    try {
      const result = eval(`!!${key}`);
      if (result) {
        console.log(`Phantom detected via: ${key}`);
      }
      return result;
    } catch {
      return false;
    }
  });
  
  wallets.phantom = {
    name: 'Phantom',
    isAvailable: phantomAvailable,
    isInstalled: phantomAvailable,
    canConnect: phantomAvailable,
    deepLinkUrl: DEFAULT_CONFIG.fallbackUrls.phantom
  };
  
  // Check for Solflare
  const solflareAvailable = WALLET_DETECTION_KEYS.solflare.some(key => {
    try {
      const result = eval(`!!${key}`);
      if (result) {
        console.log(`Solflare detected via: ${key}`);
      }
      return result;
    } catch {
      return false;
    }
  });
  
  wallets.solflare = {
    name: 'Solflare',
    isAvailable: solflareAvailable,
    isInstalled: solflareAvailable,
    canConnect: solflareAvailable,
    deepLinkUrl: DEFAULT_CONFIG.fallbackUrls.solflare
  };
  
  // Check for Backpack
  const backpackAvailable = WALLET_DETECTION_KEYS.backpack.some(key => {
    try {
      const result = eval(`!!${key}`);
      if (result) {
        console.log(`Backpack detected via: ${key}`);
      }
      return result;
    } catch {
      return false;
    }
  });
  
  wallets.backpack = {
    name: 'Backpack',
    isAvailable: backpackAvailable,
    isInstalled: backpackAvailable,
    canConnect: backpackAvailable,
    deepLinkUrl: DEFAULT_CONFIG.fallbackUrls.backpack
  };
  
  console.log('Wallet Detection Results:', {
    wallets,
    environment: { isTWA: isTWAEnv, isMobile: isMobileEnv },
    userAgent: navigator.userAgent
  });
  return wallets;
}

/**
 * Attempt to connect to a specific wallet with enhanced TWA support
 */
export async function connectToWallet(walletName: string): Promise<boolean> {
  const wallets = detectWallets();
  const wallet = wallets[walletName.toLowerCase()];
  const isTWAEnv = isTWA();
  
  if (!wallet) {
    console.error(`Wallet ${walletName} not found`);
    return false;
  }
  
  if (!wallet.isAvailable) {
    console.log(`Wallet ${walletName} not available, attempting deep link`);
    
    // Try deep linking to the wallet app
    if (wallet.deepLinkUrl) {
      try {
        // For TWA, we might need to handle deep linking differently
        if (isTWAEnv) {
          // Try to open in the same window first
          window.location.href = wallet.deepLinkUrl;
        } else {
          // For regular mobile, open in new window/tab
          window.open(wallet.deepLinkUrl, '_blank');
        }
        return true;
      } catch (error) {
        console.error(`Failed to deep link to ${walletName}:`, error);
        return false;
      }
    }
    
    return false;
  }
  
  // Wallet is available, try to connect
  try {
    switch (walletName.toLowerCase()) {
      case 'phantom':
        if ((window as any).phantom?.solana) {
          console.log('Connecting to Phantom wallet...');
          await (window as any).phantom.solana.connect();
          console.log('Phantom wallet connected successfully');
          return true;
        }
        break;
      case 'solflare':
        if ((window as any).solflare) {
          console.log('Connecting to Solflare wallet...');
          await (window as any).solflare.connect();
          console.log('Solflare wallet connected successfully');
          return true;
        }
        break;
      case 'backpack':
        if ((window as any).backpack) {
          console.log('Connecting to Backpack wallet...');
          await (window as any).backpack.connect();
          console.log('Backpack wallet connected successfully');
          return true;
        }
        break;
    }
  } catch (error) {
    console.error(`Failed to connect to ${walletName}:`, error);
    return false;
  }
  
  return false;
}

/**
 * Get the best available wallet for the current environment
 */
export function getBestWallet(linkedAccounts?: any[]): string | null {
  const wallets = detectWallets();
  const isTWAEnv = isTWA();
  const isMobileEnv = isMobile();
  
  console.log('Environment check:', { isTWA: isTWAEnv, isMobile: isMobileEnv });
  
  // First, check if we have a connected wallet from Privy
  if (linkedAccounts && linkedAccounts.length > 0) {
    const connectedWallet = linkedAccounts.find((account: any) => 
      account.type === 'wallet' && (account as any).walletClientType
    );
    
    if (connectedWallet) {
      const walletClientType = (connectedWallet as any).walletClientType;
      console.log(`🔍 Found connected wallet: ${walletClientType}`);
      
      // If the connected wallet is available as an extension, prioritize it
      const walletName = walletClientType.toLowerCase();
      if (wallets[walletName] && wallets[walletName].isAvailable) {
        console.log(`✅ Connected wallet ${walletName} is available as extension`);
        return walletName;
      } else {
        console.log(`⚠️ Connected wallet ${walletName} is not available as extension, but user is connected`);
        // Still return the connected wallet type even if extension isn't available
        // This handles cases where Privy is managing the connection
        return walletName;
      }
    }
  }
  
  // Priority order: Phantom > Solflare > Backpack
  const priority = ['phantom', 'solflare', 'backpack'];
  
  for (const walletName of priority) {
    const wallet = wallets[walletName];
    if (wallet && wallet.isAvailable) {
      console.log(`Best wallet found: ${walletName}`);
      return walletName;
    }
  }
  
  // If no wallet is available but we're on mobile, suggest Phantom
  if (isMobileEnv || isTWAEnv) {
    console.log('No wallet detected on mobile, suggesting Phantom');
    return 'phantom';
  }
  
  return null;
}

/**
 * Get debug information for troubleshooting
 */
export function getDebugInfo(linkedAccounts?: any[]) {
  return {
    environment: {
      isTWA: isTWA(),
      isMobile: isMobile(),
      userAgent: navigator.userAgent,
      displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      platform: navigator.platform,
    },
    wallets: detectWallets(),
    bestWallet: getBestWallet(linkedAccounts),
    currentWallet: getCurrentWallet(linkedAccounts),
    linkedAccounts: linkedAccounts?.map((account: any) => ({
      type: account.type,
      walletClientType: (account as any).walletClientType,
      chainType: (account as any).chainType,
      address: (account as any).address
    })) || [],
    window: {
      hasPhantom: !!(window as any).phantom,
      hasSolflare: !!(window as any).solflare,
      hasBackpack: !!(window as any).backpack,
      hasTrustedTypes: 'trustedTypes' in window,
      hasAndroid: (window as any).Android !== undefined,
    }
  };
}

/**
 * Detect which wallet is currently connected and available for transactions
 */
export function getCurrentWallet(linkedAccounts?: any[]): string | null {
  // First, check if we have linked accounts from Privy to determine the actual connected wallet
  if (linkedAccounts && linkedAccounts.length > 0) {
    // Find the first wallet account
    const walletAccount = linkedAccounts.find((account: any) => 
      account.type === 'wallet' && (account as any).walletClientType
    );
    
    if (walletAccount) {
      const walletClientType = (walletAccount as any).walletClientType;
      console.log(`🔍 Found connected wallet from Privy: ${walletClientType}`);
      
      // Map wallet client types to our detection logic
      switch (walletClientType.toLowerCase()) {
        case 'phantom':
          return 'phantom';
        case 'solflare':
          return 'solflare';
        case 'backpack':
          return 'backpack';
        case 'privy':
          // For embedded wallets, we need to check what's available
          console.log('Embedded wallet detected, checking available extensions...');
          break;
        default:
          console.log(`Unknown wallet client type: ${walletClientType}`);
      }
    }
  }
  
  // Fallback to browser extension detection if no linked accounts or embedded wallet
  if ((window as any).phantom?.solana) {
    return 'phantom';
  } else if ((window as any).solflare) {
    return 'solflare';
  } else if ((window as any).backpack) {
    return 'backpack';
  } else if ((window as any).solana) {
    return 'generic-solana';
  }
  
  return null;
}

/**
 * Get wallet-specific transaction signing method
 */
export async function signTransactionWithWallet(transaction: any, walletType?: string): Promise<string> {
  const currentWallet = walletType || getCurrentWallet();
  
  console.log(`Attempting to sign transaction with wallet: ${currentWallet}`);
  console.log('Transaction details:', {
    instructions: transaction.instructions?.length || 0,
    feePayer: transaction.feePayer?.toString(),
    recentBlockhash: transaction.recentBlockhash,
    signatures: transaction.signatures?.length || 0
  });
  
  try {
    let result: any;
    
    switch (currentWallet) {
      case 'phantom':
        if (!(window as any).phantom?.solana) {
          throw new Error('Phantom wallet not found');
        }
        console.log('Using Phantom wallet for transaction signing');
        result = await (window as any).phantom.solana.signAndSendTransaction(transaction);
        break;
        
      case 'solflare':
        if (!(window as any).solflare) {
          throw new Error('Solflare wallet not found');
        }
        console.log('Using Solflare wallet for transaction signing');
        
        // Additional Solflare-specific debugging
        const solflare = (window as any).solflare;
        console.log('Solflare wallet details:', {
          isSolflare: solflare.isSolflare,
          hasConnect: typeof solflare.connect === 'function',
          hasSignAndSendTransaction: typeof solflare.signAndSendTransaction === 'function',
          hasSignTransaction: typeof solflare.signTransaction === 'function',
          hasDisconnect: typeof solflare.disconnect === 'function'
        });
        
        result = await solflare.signAndSendTransaction(transaction);
        break;
        
      case 'backpack':
        if (!(window as any).backpack) {
          throw new Error('Backpack wallet not found');
        }
        console.log('Using Backpack wallet for transaction signing');
        result = await (window as any).backpack.signAndSendTransaction(transaction);
        break;
        
      case 'generic-solana':
        if (!(window as any).solana) {
          throw new Error('Generic Solana wallet not found');
        }
        console.log('Using generic Solana wallet for transaction signing');
        result = await (window as any).solana.signAndSendTransaction(transaction);
        break;
        
      default:
        throw new Error(`Unsupported wallet type: ${currentWallet}`);
    }
    
    const signature = result.signature || result;
    console.log(`✅ Transaction signed successfully with ${currentWallet}:`, signature);
    return signature;
    
  } catch (error) {
    console.error(`❌ Failed to sign transaction with ${currentWallet}:`, error);
    
    // Provide more detailed error information for debugging
    if (currentWallet === 'solflare') {
      console.error('Solflare-specific error details:', {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        solflareAvailable: !!(window as any).solflare,
        solflareMethods: (window as any).solflare ? {
          connect: typeof (window as any).solflare.connect,
          signAndSendTransaction: typeof (window as any).solflare.signAndSendTransaction,
          signTransaction: typeof (window as any).solflare.signTransaction
        } : 'Solflare not available'
      });
    }
    
    throw error;
  }
}

/**
 * Initialize mobile wallet adapter with enhanced TWA support
 */
export function initializeMobileWalletAdapter(config: Partial<MobileWalletAdapterConfig> = {}): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  console.log('Initializing Mobile Wallet Adapter:', finalConfig);
  
  // Detect environment
  const isTWAEnv = isTWA();
  const isMobileEnv = isMobile();
  
  // Log environment information
  console.log('Environment:', {
    isTWA: isTWAEnv,
    isMobile: isMobileEnv,
    userAgent: navigator.userAgent,
    displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
  });
  
  // For TWA environments, we might need to wait a bit for wallet injection
  if (isTWAEnv) {
    console.log('TWA environment detected, waiting for wallet injection...');
    setTimeout(() => {
      const wallets = detectWallets();
      console.log('TWA wallet detection after delay:', wallets);
    }, 2000);
  }
  
  // Detect available wallets
  const wallets = detectWallets();
  
  // Log detection results
  console.log('Available wallets:', wallets);
  
  // Store environment info for debugging
  (window as any).__MOBILE_WALLET_ADAPTER__ = {
    config: finalConfig,
    environment: { isTWA: isTWAEnv, isMobile: isMobileEnv },
    wallets,
    bestWallet: getBestWallet(),
    debugInfo: getDebugInfo()
  };
} 