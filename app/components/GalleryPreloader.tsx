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
  preloadCount = 3
}: GalleryPreloaderProps) {
  useEffect(() => {
    // Calculate which images to preload
    const preloadUrls: string[] = [];
    
    // Preload next N images
    for (let i = 1; i <= preloadCount; i++) {
      const nextIndex = (currentIndex + i) % urls.length;
      preloadUrls.push(urls[nextIndex]);
    }
    
    // Preload previous image if available
    if (currentIndex > 0) {
      preloadUrls.unshift(urls[currentIndex - 1]);
    }
    
    // Start preloading
    preloadImages(preloadUrls);
  }, [urls, currentIndex, preloadCount]);

  // This is a utility component that doesn't render anything
  return null;
} 