import React, { useEffect, useState, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { getPrioritizedImageUrl, isImagePreloaded } from '../utils/ImagePreloader';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
  // New props for gallery/slider images
  isGalleryImage?: boolean;
  galleryIndex?: number;
  fallbackSrc?: string;
  retryCount?: number;
}

type LoadingState = 'initial' | 'loading' | 'loaded' | 'error';

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  loading: propLoading,
  onLoad,
  onError,
  isGalleryImage = false,
  galleryIndex = 0,
  fallbackSrc,
  retryCount = 2,
}: OptimizedImageProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>('initial');
  const [retries, setRetries] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(src);
  
  // Use a larger rootMargin for gallery images to start loading earlier
  const rootMargin = isGalleryImage ? '100px 0px' : '50px 0px';
  
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin,
    // For gallery images, we want to track when they enter/leave the viewport
    trackVisibility: isGalleryImage,
    delay: isGalleryImage ? 100 : 0,
  });

  // Determine effective priority
  const effectivePriority = useMemo(() => {
    // Always high priority for above-the-fold content
    if (priority) return 'high';
    // Gallery images near the viewport get medium priority
    if (isGalleryImage && galleryIndex < 3) return 'high';
    // Everything else is low priority
    return 'low';
  }, [priority, isGalleryImage, galleryIndex]);

  // Construct URL with priority parameters
  const imageUrl = useMemo(() => {
    return getPrioritizedImageUrl(currentSrc, effectivePriority as 'high' | 'low', inView);
  }, [currentSrc, effectivePriority, inView]);

  // Determine loading strategy
  const loading = priority ? 'eager' : propLoading || 'lazy';

  // Reset state when src changes
  useEffect(() => {
    setCurrentSrc(src);
    setLoadingState('initial');
    setRetries(0);
  }, [src]);

  // Handle load event
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoadingState('loaded');
    onLoad?.();
  };

  // Handle error event
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (retries < retryCount) {
      // Retry loading after a delay
      setRetries(prev => prev + 1);
      setTimeout(() => {
        setCurrentSrc(`${src}${src.includes('?') ? '&' : '?'}retry=${retries + 1}`);
      }, Math.min(1000 * Math.pow(2, retries), 5000));
    } else if (fallbackSrc && currentSrc !== fallbackSrc) {
      // Try fallback image
      setCurrentSrc(fallbackSrc);
      setRetries(0);
    } else {
      setLoadingState('error');
      onError?.();
    }
  };

  // Start loading when in view or preloaded
  useEffect(() => {
    if (loadingState === 'initial' && (inView || isImagePreloaded(src) || priority)) {
      setLoadingState('loading');
    }
  }, [inView, src, loadingState, priority]);

  return (
    <div 
      ref={ref}
      className={`relative ${className}`}
      style={{
        aspectRatio: width && height ? `${width}/${height}` : 'auto',
      }}
    >
      {loadingState !== 'initial' && (
        <img
          src={imageUrl}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          className={`transition-opacity duration-300 ${
            loadingState === 'loaded' ? 'opacity-100' : 'opacity-0'
          } absolute top-0 left-0 w-full h-full object-cover`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      
      {/* Loading placeholder */}
      {loadingState !== 'loaded' && (
        <div 
          className="absolute top-0 left-0 w-full h-full bg-gray-100 animate-pulse"
          style={{
            aspectRatio: width && height ? `${width}/${height}` : 'auto',
          }}
        />
      )}

      {/* Error state */}
      {loadingState === 'error' && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-gray-100">
          <span className="text-gray-500">Failed to load image</span>
        </div>
      )}
    </div>
  );
} 