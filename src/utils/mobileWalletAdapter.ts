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
 */
export function isTWA(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for TWA-specific indicators
  const isTWA = (
    // Check for TWA-specific user agent
    navigator.userAgent.includes('TWA') ||
    // Check for standalone mode (PWA)
    window.matchMedia('(display-mode: standalone)').matches ||
    // Check for minimal UI mode
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // Check for fullscreen mode
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // Check for Android WebView
    navigator.userAgent.includes('wv') ||
    // Check for custom TWA indicator
    (window as any).__TWA__ === true
  );
  
  console.log('TWA Detection:', { isTWA, userAgent: navigator.userAgent });
  return isTWA;
}

/**
 * Detect if we're on a mobile device
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  
  const isMobile = (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  );
  
  return isMobile;
}

/**
 * Detect available wallets on the current device
 */
export function detectWallets(): Record<string, MobileWalletInfo> {
  const wallets: Record<string, MobileWalletInfo> = {};
  
  // Check for Phantom
  const phantomAvailable = WALLET_DETECTION_KEYS.phantom.some(key => {
    try {
      return eval(`!!${key}`);
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
      return eval(`!!${key}`);
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
      return eval(`!!${key}`);
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
  
  console.log('Wallet Detection Results:', wallets);
  return wallets;
}

/**
 * Attempt to connect to a specific wallet
 */
export async function connectToWallet(walletName: string): Promise<boolean> {
  const wallets = detectWallets();
  const wallet = wallets[walletName.toLowerCase()];
  
  if (!wallet) {
    console.error(`Wallet ${walletName} not found`);
    return false;
  }
  
  if (!wallet.isAvailable) {
    console.log(`Wallet ${walletName} not available, attempting deep link`);
    
    // Try deep linking to the wallet app
    if (wallet.deepLinkUrl) {
      try {
        window.location.href = wallet.deepLinkUrl;
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
          await (window as any).phantom.solana.connect();
          return true;
        }
        break;
      case 'solflare':
        if ((window as any).solflare) {
          await (window as any).solflare.connect();
          return true;
        }
        break;
      case 'backpack':
        if ((window as any).backpack) {
          await (window as any).backpack.connect();
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
 * Initialize mobile wallet adapter
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
  
  // Detect available wallets
  const wallets = detectWallets();
  
  // Log detection results
  console.log('Available wallets:', wallets);
  
  // Store environment info for debugging
  (window as any).__MOBILE_WALLET_ADAPTER__ = {
    config: finalConfig,
    environment: { isTWA: isTWAEnv, isMobile: isMobileEnv },
    wallets,
    bestWallet: getBestWallet()
  };
}

/**
 * Get mobile wallet adapter debug info
 */
export function getDebugInfo() {
  return (window as any).__MOBILE_WALLET_ADAPTER__ || null;
} 