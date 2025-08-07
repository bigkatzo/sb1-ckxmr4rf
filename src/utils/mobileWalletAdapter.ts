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
export function getBestWallet(): string | null {
  const wallets = detectWallets();
  const isTWAEnv = isTWA();
  const isMobileEnv = isMobile();
  
  console.log('Environment check:', { isTWA: isTWAEnv, isMobile: isMobileEnv });
  
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
export function getDebugInfo() {
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
    bestWallet: getBestWallet(),
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