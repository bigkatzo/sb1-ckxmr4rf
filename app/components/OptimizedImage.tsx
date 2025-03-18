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
}

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
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasStartedLoading, setHasStartedLoading] = useState(false);
  
  // Use a larger rootMargin for gallery images to start loading earlier
  const rootMargin = isGalleryImage ? '100px 0px' : '50px 0px';
  
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin,
    // For gallery images, we want to track when they enter/leave the viewport
    // For regular images, we only need to know when they first enter
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
    return getPrioritizedImageUrl(src, effectivePriority as 'high' | 'low', inView);
  }, [src, effectivePriority, inView]);

  // Determine loading strategy
  const loading = priority ? 'eager' : propLoading || 'lazy';

  // Start loading when in view or preloaded
  useEffect(() => {
    if (!hasStartedLoading && (inView || isImagePreloaded(src) || priority)) {
      setHasStartedLoading(true);
    }
  }, [inView, src, hasStartedLoading, priority]);

  // Handle load event
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true);
    onLoad?.();
  };

  // Handle error event
  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error(`Failed to load image: ${imageUrl}`);
    onError?.();
  };

  return (
    <div 
      ref={ref}
      className={`relative ${className}`}
      style={{
        aspectRatio: width && height ? `${width}/${height}` : 'auto',
      }}
    >
      {hasStartedLoading && (
        <img
          src={imageUrl}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } absolute top-0 left-0 w-full h-full object-cover`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      
      {/* Placeholder while loading */}
      {!isLoaded && (
        <div 
          className="absolute top-0 left-0 w-full h-full bg-gray-100 animate-pulse"
          style={{
            aspectRatio: width && height ? `${width}/${height}` : 'auto',
          }}
        />
      )}
    </div>
  );
} 