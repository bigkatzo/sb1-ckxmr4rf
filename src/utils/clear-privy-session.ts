/**
 * Utility function to completely clear Privy session data
 * This helps when users are stuck in a wrong chain or authentication state
 */
export function clearPrivySession(): void {
  try {
    // Clear localStorage
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach(key => {
      if (key.toLowerCase().includes('privy')) {
        localStorage.removeItem(key);
        console.log(`Cleared localStorage key: ${key}`);
      }
    });

    // Clear sessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorageKeys.forEach(key => {
      if (key.toLowerCase().includes('privy') || key.toLowerCase().includes('wallet')) {
        sessionStorage.removeItem(key);
        console.log(`Cleared sessionStorage key: ${key}`);
      }
    });

    // Clear cookies
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
      const [name] = cookie.split('=');
      if (name.trim().toLowerCase().includes('privy')) {
        document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        console.log(`Cleared cookie: ${name.trim()}`);
      }
    });

    // Clear any Privy-related data from window object
    if ((window as any).privy) {
      delete (window as any).privy;
      console.log('Cleared window.privy');
    }

    console.log('✅ Privy session cleared successfully');
    
    // Reload the page to reset everything
    window.location.reload();
  } catch (error) {
    console.error('Error clearing Privy session:', error);
  }
}

/**
 * Check if user is connected to the wrong chain
 */
export function isWrongChain(user: any): boolean {
  if (!user?.wallet) return false;
  
  const chainId = user.wallet.chainId?.toString();
  const chainType = user.wallet.chainType;
  
  return chainId !== '1399811150' || chainType !== 'solana';
}

/**
 * Get chain information for debugging
 */
export function getChainInfo(user: any): { chainId: string | undefined; chainType: string | undefined; isCorrect: boolean } {
  if (!user?.wallet) {
    return { chainId: undefined, chainType: undefined, isCorrect: false };
  }
  
  const chainId = user.wallet.chainId?.toString();
  const chainType = user.wallet.chainType;
  const isCorrect = chainId === '1399811150' && chainType === 'solana';
  
  return { chainId, chainType, isCorrect };
} 