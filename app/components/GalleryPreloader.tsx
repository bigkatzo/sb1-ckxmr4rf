import { useEffect } from 'react';
import { preloadImages } from '../utils/ImagePreloader';

interface GalleryPreloaderProps {
  urls: string[];
  currentIndex: number;
  preloadCount?: number;
}

export function GalleryPreloader({
  urls,
  currentIndex,
  preloadCount = 2
}: GalleryPreloaderProps) {
  useEffect(() => {
    // Only preload if we have URLs and we're not at the end
    if (!urls.length || currentIndex >= urls.length - 1) return;
    
    // Calculate which images to preload
    const preloadUrls: string[] = [];
    
    // Only preload next images (not previous)
    for (let i = 1; i <= preloadCount && currentIndex + i < urls.length; i++) {
      preloadUrls.push(urls[currentIndex + i]);
    }
    
    // Use requestIdleCallback for preloading if available
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        preloadImages(preloadUrls);
      });
    } else {
      // Fallback to setTimeout
      setTimeout(() => {
        preloadImages(preloadUrls);
      }, 1000);
    }
  }, [urls, currentIndex, preloadCount]);

  // This is a utility component that doesn't render anything
  return null;
} 