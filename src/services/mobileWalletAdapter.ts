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
    detectionKey: 'phantom.solana'
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
    detectionKey: 'solflare.isSolflare'
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
    detectionKey: 'backpack'
  }
};

export class MobileWalletAdapter {
  private static instance: MobileWalletAdapter;
  private redirectAttempts: Map<string, number> = new Map();
  private maxRedirectAttempts = 3;

  static getInstance(): MobileWalletAdapter {
    if (!MobileWalletAdapter.instance) {
      MobileWalletAdapter.instance = new MobileWalletAdapter();
    }
    return MobileWalletAdapter.instance;
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
   * Check if a specific wallet is installed
   */
  isWalletInstalled(walletName: string): boolean {
    const config = WALLET_CONFIGS[walletName];
    if (!config) return false;

    try {
      // Use eval to safely check for wallet objects
      const detectionPath = config.detectionKey.split('.');
      let current: any = window;
      
      for (const key of detectionPath) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          return false;
        }
      }
      
      return !!current;
    } catch (error) {
      console.warn(`Error checking if ${walletName} is installed:`, error);
      return false;
    }
  }

  /**
   * Attempt to redirect to wallet app with fallback mechanisms
   */
  async redirectToWallet(walletName: string): Promise<boolean> {
    const config = WALLET_CONFIGS[walletName];
    if (!config) {
      console.error(`Unknown wallet: ${walletName}`);
      return false;
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
   * Handle mobile wallet redirection with multiple fallback mechanisms
   */
  private async handleMobileRedirect(config: WalletConfig): Promise<boolean> {
    const platform = this.getMobilePlatform();
    const appStoreLink = platform === 'other' ? config.appStoreLinks.android : config.appStoreLinks[platform];
    const currentUrl = encodeURIComponent(window.location.href);
    
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

    // Method 3: App Store fallback (after longer delay)
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

    redirectPromises.push(universalLinkPromise, deepLinkPromise, appStorePromise);

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
   * Attempt a single redirect with error handling
   */
  private async attemptRedirect(url: string, isDeepLink: boolean = false): Promise<boolean> {
    try {
      if (isDeepLink) {
        // For deep links, create a temporary link element
        const link = document.createElement('a');
        link.href = url;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
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
}

// Export singleton instance
export const mobileWalletAdapter = MobileWalletAdapter.getInstance(); 