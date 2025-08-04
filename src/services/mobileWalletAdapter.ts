// Mobile Wallet Adapter Service
// Handles mobile wallet detection, redirection, and fallback mechanisms

export interface WalletConfig {
  name: string;
  universalLink: string;
  deepLink: string;
  appStoreLinks: {
    ios: string;
    android: string;
  };
  websiteUrl: string;
  detectionKey: string;
  // Add TWA-specific configurations
  twaFallbackUrl?: string;
  twaDetectionKeys?: string[];
  // Add TWA-specific redirect URL
  twaRedirectUrl?: string;
}

export const WALLET_CONFIGS: Record<string, WalletConfig> = {
  phantom: {
    name: 'Phantom',
    universalLink: 'https://phantom.app/ul/browse/',
    deepLink: 'phantom://browse?url=',
    appStoreLinks: {
      ios: 'https://apps.apple.com/us/app/phantom-solana-wallet/id1598432977',
      android: 'https://play.google.com/store/apps/details?id=app.phantom'
    },
    websiteUrl: 'https://phantom.com/',
    detectionKey: 'phantom.solana',
    twaFallbackUrl: 'https://phantom.app/ul/browse/',
    twaDetectionKeys: ['phantom.solana', 'window.phantom', 'window.solana'],
    // Add TWA-specific redirect URL
    twaRedirectUrl: `${window.location.origin}/wallet-redirect?wallet=phantom`
  },
  solflare: {
    name: 'Solflare',
    universalLink: 'https://solflare.com/ul/browse/',
    deepLink: 'solflare://browse?url=',
    appStoreLinks: {
      ios: 'https://apps.apple.com/us/app/solflare-solana-wallet/id1580902717',
      android: 'https://play.google.com/store/apps/details?id=com.solflare.mobile'
    },
    websiteUrl: 'https://solflare.com/',
    detectionKey: 'solflare.isSolflare',
    twaFallbackUrl: 'https://solflare.com/ul/browse/',
    twaDetectionKeys: ['solflare.isSolflare', 'window.solflare', 'window.solana'],
    // Add TWA-specific redirect URL
    twaRedirectUrl: `${window.location.origin}/wallet-redirect?wallet=solflare`
  },
  backpack: {
    name: 'Backpack',
    universalLink: 'https://backpack.app/ul/browse/',
    deepLink: 'backpack://browse?url=',
    appStoreLinks: {
      ios: 'https://apps.apple.com/us/app/backpack-crypto-wallet/id6446671622',
      android: 'https://play.google.com/store/apps/details?id=app.backpack'
    },
    websiteUrl: 'https://backpack.app/',
    detectionKey: 'backpack',
    twaFallbackUrl: 'https://backpack.app/ul/browse/',
    twaDetectionKeys: ['backpack', 'window.backpack', 'window.solana'],
    // Add TWA-specific redirect URL
    twaRedirectUrl: `${window.location.origin}/wallet-redirect?wallet=backpack`
  }
};

export class MobileWalletAdapter {
  private static instance: MobileWalletAdapter;
  private redirectAttempts: Map<string, number> = new Map();
  private maxRedirectAttempts = 3;
  private isTWA: boolean;
  private connectionState: Map<string, boolean> = new Map();
  private redirectCallbacks: Map<string, (success: boolean) => void> = new Map();

  constructor() {
    // Detect if running in TWA context
    this.isTWA = this.detectTWA();
    this.initializeConnectionMonitoring();
  }

  static getInstance(): MobileWalletAdapter {
    if (!MobileWalletAdapter.instance) {
      MobileWalletAdapter.instance = new MobileWalletAdapter();
    }
    return MobileWalletAdapter.instance;
  }

  /**
   * Initialize connection monitoring for seamless wallet detection
   */
  private initializeConnectionMonitoring(): void {
    // Monitor for wallet connection events
    window.addEventListener('focus', () => {
      this.checkWalletConnections();
    });

    // Check for wallet connections periodically
    setInterval(() => {
      this.checkWalletConnections();
    }, 2000);

    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkWalletConnections();
      }
    });
  }

  /**
   * Check if wallets are now available after redirects
   */
  private checkWalletConnections(): void {
    Object.keys(WALLET_CONFIGS).forEach(walletName => {
      const wasConnected = this.connectionState.get(walletName) || false;
      const isNowConnected = this.isWalletInstalled(walletName);
      
      if (!wasConnected && isNowConnected) {
        console.log(`Wallet ${walletName} is now available!`);
        this.connectionState.set(walletName, true);
        
        // Notify any pending callbacks
        const callback = this.redirectCallbacks.get(walletName);
        if (callback) {
          callback(true);
          this.redirectCallbacks.delete(walletName);
        }
      } else if (wasConnected && !isNowConnected) {
        this.connectionState.set(walletName, false);
      }
    });
  }

  /**
   * Detect if running in TWA context
   */
  private detectTWA(): boolean {
    // Check for TWA-specific indicators
    const userAgent = navigator.userAgent;
    const isAndroid = /Android/i.test(userAgent);
    const hasTWAIndicators = 
      window.location.href.includes('android-app://') ||
      document.referrer.includes('android-app://') ||
      (isAndroid && (window.navigator as any).standalone === undefined);
    
    return hasTWAIndicators;
  }

  /**
   * Enhanced mobile detection
   */
  isMobile(): boolean {
    const userAgent = navigator.userAgent;
    const mobileRegex = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini|CriOS|FxiOS/i;
    return mobileRegex.test(userAgent);
  }

  /**
   * Detect specific mobile platform
   */
  getMobilePlatform(): 'ios' | 'android' | 'other' {
    const userAgent = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(userAgent)) {
      return 'ios';
    } else if (/Android/i.test(userAgent)) {
      return 'android';
    }
    return 'other';
  }

  /**
   * Enhanced wallet detection for TWA context
   */
  isWalletInstalled(walletName: string): boolean {
    const config = WALLET_CONFIGS[walletName];
    if (!config) return false;

    try {
      // Use multiple detection keys for better reliability
      const detectionKeys = config.twaDetectionKeys || [config.detectionKey];
      
      for (const detectionKey of detectionKeys) {
        const detectionPath = detectionKey.split('.');
        let current: any = window;
        
        for (const key of detectionPath) {
          if (current && typeof current === 'object' && key in current) {
            current = current[key];
          } else {
            current = null;
            break;
          }
        }
        
        if (current) {
          console.log(`Wallet ${walletName} detected via key: ${detectionKey}`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.warn(`Error checking if ${walletName} is installed:`, error);
      return false;
    }
  }

  /**
   * Enhanced wallet redirect with callback support
   */
  async redirectToWallet(walletName: string, callback?: (success: boolean) => void): Promise<boolean> {
    const config = WALLET_CONFIGS[walletName];
    if (!config) {
      console.error(`Unknown wallet: ${walletName}`);
      return false;
    }

    // Store callback if provided
    if (callback) {
      this.redirectCallbacks.set(walletName, callback);
    }

    const attempts = this.redirectAttempts.get(walletName) || 0;
    if (attempts >= this.maxRedirectAttempts) {
      console.warn(`Max redirect attempts reached for ${walletName}`);
      return false;
    }

    this.redirectAttempts.set(walletName, attempts + 1);

    if (this.isMobile()) {
      return this.handleMobileRedirect(config);
    } else {
      return this.handleDesktopRedirect(config);
    }
  }

  /**
   * Enhanced mobile wallet redirection with TWA-specific handling
   */
  private async handleMobileRedirect(config: WalletConfig): Promise<boolean> {
    const platform = this.getMobilePlatform();
    const appStoreLink = platform === 'other' ? config.appStoreLinks.android : config.appStoreLinks[platform];
    const currentUrl = encodeURIComponent(window.location.href);
    
    console.log(`Attempting mobile redirect for ${config.name} in TWA: ${this.isTWA}`);
    
    let hasRedirected = false;
    const redirectPromises: Promise<boolean>[] = [];

    // Method 1: Universal Link (most reliable)
    const universalLinkPromise = this.attemptRedirect(
      `${config.universalLink}${currentUrl}`,
      false
    ).then(success => {
      if (success) hasRedirected = true;
      return success;
    });

    // Method 2: Deep Link (after delay)
    const deepLinkPromise = new Promise<boolean>(resolve => {
      setTimeout(() => {
        if (!hasRedirected) {
          this.attemptRedirect(`${config.deepLink}${currentUrl}`, true)
            .then(success => {
              if (success) hasRedirected = true;
              resolve(success);
            });
        } else {
          resolve(false);
        }
      }, 1500);
    });

    // Method 3: TWA-specific redirect (if in TWA context and URL is available)
    const twaRedirectPromise = new Promise<boolean>(resolve => {
      if (this.isTWA && config.twaRedirectUrl) {
        setTimeout(() => {
          if (!hasRedirected) {
            this.attemptRedirect(config.twaRedirectUrl!, false)
              .then(success => {
                if (success) hasRedirected = true;
                resolve(success);
              });
          } else {
            resolve(false);
          }
        }, 2000);
      } else {
        resolve(false);
      }
    });

    // Method 4: TWA-specific fallback (if in TWA context)
    const twaFallbackPromise = new Promise<boolean>(resolve => {
      if (this.isTWA && config.twaFallbackUrl) {
        setTimeout(() => {
          if (!hasRedirected) {
            this.attemptRedirect(`${config.twaFallbackUrl}${currentUrl}`, false)
              .then(success => {
                if (success) hasRedirected = true;
                resolve(success);
              });
          } else {
            resolve(false);
          }
        }, 2500);
      } else {
        resolve(false);
      }
    });

    // Method 5: App Store fallback (after longer delay)
    const appStorePromise = new Promise<boolean>(resolve => {
      setTimeout(() => {
        if (!hasRedirected) {
          this.attemptRedirect(appStoreLink, false)
            .then(success => {
              if (success) hasRedirected = true;
              resolve(success);
            });
        } else {
          resolve(false);
        }
      }, 3000);
    });

    redirectPromises.push(universalLinkPromise, deepLinkPromise, twaRedirectPromise, twaFallbackPromise, appStorePromise);

    try {
      const results = await Promise.race(redirectPromises);
      return results;
    } catch (error) {
      console.error(`Error during mobile redirect for ${config.name}:`, error);
      return false;
    }
  }

  /**
   * Handle desktop wallet redirection
   */
  private async handleDesktopRedirect(config: WalletConfig): Promise<boolean> {
    try {
      const newWindow = window.open(config.websiteUrl, '_blank');
      if (newWindow) {
        newWindow.focus();
        return true;
      } else {
        // Fallback to same window if popup blocked
        window.location.href = config.websiteUrl;
        return true;
      }
    } catch (error) {
      console.error(`Error during desktop redirect for ${config.name}:`, error);
      return false;
    }
  }

  /**
   * Enhanced redirect attempt with better error handling
   */
  private async attemptRedirect(url: string, isDeepLink: boolean = false): Promise<boolean> {
    try {
      console.log(`Attempting redirect to: ${url} (deep link: ${isDeepLink})`);
      
      if (isDeepLink) {
        // For deep links, create a temporary link element
        const link = document.createElement('a');
        link.href = url;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For TWA context, try to open in new tab first
        if (this.isTWA) {
          const newWindow = window.open(url, '_blank');
          if (newWindow) {
            newWindow.focus();
            return true;
          }
        }
        // Fallback to location change
        window.location.href = url;
      }
      return true;
    } catch (error) {
      console.warn(`Redirect attempt failed for ${url}:`, error);
      return false;
    }
  }

  /**
   * Reset redirect attempts for a wallet
   */
  resetRedirectAttempts(walletName: string): void {
    this.redirectAttempts.delete(walletName);
  }

  /**
   * Get available wallets for current platform
   */
  getAvailableWallets(): string[] {
    return Object.keys(WALLET_CONFIGS).filter(walletName => 
      this.isWalletInstalled(walletName)
    );
  }

  /**
   * Get recommended wallet for current platform
   */
  getRecommendedWallet(): string | null {
    const available = this.getAvailableWallets();
    if (available.length > 0) {
      // Prioritize Phantom, then Solflare, then others
      return available.find(w => w === 'phantom') || 
             available.find(w => w === 'solflare') || 
             available[0];
    }
    return null;
  }

  /**
   * Get TWA status
   */
  getTWAStatus(): boolean {
    return this.isTWA;
  }

  /**
   * Get connection state for a wallet
   */
  getWalletConnectionState(walletName: string): boolean {
    return this.connectionState.get(walletName) || false;
  }

  /**
   * Get all wallet connection states
   */
  getAllWalletStates(): Record<string, boolean> {
    const states: Record<string, boolean> = {};
    Object.keys(WALLET_CONFIGS).forEach(walletName => {
      states[walletName] = this.getWalletConnectionState(walletName);
    });
    return states;
  }
}

// Export singleton instance
export const mobileWalletAdapter = MobileWalletAdapter.getInstance(); 