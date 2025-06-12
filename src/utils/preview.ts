/**
 * Utility functions for handling preview mode for hidden/unpublished content
 */

import { cacheManager } from '../lib/cache';

/**
 * Checks if the current URL has the preview query parameter
 */
export function isPreviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has('preview');
}

/**
 * Gets the preview parameter value from URL search params
 */
export function getPreviewParam(): string | null {
  if (typeof window === 'undefined') return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('preview');
}

/**
 * Adds or removes the preview parameter from a URL
 */
export function togglePreviewParam(url: string, enable: boolean): string {
  const urlObj = new URL(url, window.location.origin);
  
  if (enable) {
    urlObj.searchParams.set('preview', 'true');
  } else {
    urlObj.searchParams.delete('preview');
  }
  
  // Return relative URL
  return urlObj.pathname + urlObj.search;
}

/**
 * Clears all preview-specific cache entries
 */
export async function clearPreviewCache(): Promise<void> {
  // Get cache statistics to find all keys
  const stats = await cacheManager.getStats();
  
  // Iterate through memory cache and invalidate preview entries
  for (const [key] of stats.metrics.entries()) {
    if (key.includes(':preview')) {
      cacheManager.invalidateKey(key);
    }
  }
}

/**
 * Checks if preview mode is enabled and the user has permission to view hidden content
 * For now, we'll allow preview mode for any user, but this could be extended to check
 * for admin permissions or other authorization logic
 */
export function canPreviewHiddenContent(): boolean {
  return isPreviewMode();
} 