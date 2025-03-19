import { supabase } from './supabase';
import { cacheManager } from './cache';
import { normalizeStorageUrl } from './storage';

/**
 * Preloads critical data into the cache for faster initial page load
 * Only caches high-frequency data that needs sub-second access
 */
export async function preloadCriticalData() {
  try {
    // Get current stock levels and prices
    const { data: products } = await supabase
      .from('products')
      .select('id, price, stock')
      .filter('visible', 'eq', true);

    if (products) {
      products.forEach(product => {
        // Cache stock data with 500ms TTL
        cacheManager.set(
          `product_stock:${product.id}`,
          product.stock,
          500 // 500ms TTL
        );

        // Cache price data with 500ms TTL
        cacheManager.set(
          `product_price:${product.id}`,
          product.price,
          500 // 500ms TTL
        );
      });
    }

    console.log('Critical data preloaded successfully');
    return true;
  } catch (err) {
    console.error('Error preloading critical data:', err);
    return false;
  }
}

/**
 * Set up the cache preloader to run on initial load and periodically refresh
 */
export function setupCachePreloader() {
  // Run immediately
  preloadCriticalData();
  
  // Then refresh periodically
  const refreshInterval = setInterval(() => {
    preloadCriticalData();
  }, 5 * 60 * 1000); // Every 5 minutes
  
  // Return cleanup function
  return () => clearInterval(refreshInterval);
} 