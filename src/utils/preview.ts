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
 * Checks if preview mode is enabled and the user has permission to view hidden content
 */
export function canPreviewHiddenContent(): boolean {
  return isPreviewMode();
}

/**
 * Clear all preview-related cache entries
 */
export async function clearPreviewCache(): Promise<void> {
  try {
    // Get cache statistics to find all keys
    const stats = await cacheManager.getStats();
    
    // Find and invalidate all preview-related keys
    const previewKeys = Array.from(stats.metrics.keys()).filter((key: string) => 
      key.includes(':preview') || 
      key.includes('preview:') ||
      key.includes('collection:') ||
      key.includes('product:') ||
      key.includes('category:')
    );
    
    // Invalidate each key
    await Promise.all(previewKeys.map((key: string) => cacheManager.invalidateKey(key)));
    
    console.log('Cleared preview cache keys:', previewKeys);
  } catch (err) {
    console.error('Error clearing preview cache:', err);
  }
}

/**
 * Get the cache key for a resource, taking preview mode into account
 */
export function getPreviewAwareCacheKey(baseKey: string): string {
  return isPreviewMode() ? `${baseKey}:preview` : baseKey;
} 