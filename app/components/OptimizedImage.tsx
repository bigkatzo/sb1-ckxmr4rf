import React, { useState, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';

// Import the normalizeStorageUrl function
const normalizeStorageUrl = (url: string): string => {
  if (!url) return '';
  
  try {
    // Parse the URL to handle it properly
    const parsedUrl = new URL(url);
    
    // Ensure HTTPS
    parsedUrl.protocol = 'https:';
    
    // Get the path
    let path = parsedUrl.pathname;
    
    // If it's already a render/image URL, don't modify it
    if (path.includes('/storage/v1/render/image/')) {
      return url;
    }
    
    // If it's an object URL, convert it to a render URL for images
    if (path.includes('/storage/v1/object/public/')) {
      // Convert to render URL for images
      path = path.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
      return `${parsedUrl.protocol}//${parsedUrl.host}${path}`;
    }
    
    // For other URLs, return as is
    return url;
  } catch (error) {
    console.error('Error normalizing URL:', error);
    
    // If URL parsing fails but it looks like a Supabase storage URL, try a simple string replace
    if (typeof url === 'string' && url.includes('/storage/v1/object/public/')) {
      return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    }
    
    // Otherwise return the original URL
    return url;
  }
};

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
  isGalleryImage?: boolean;
  fallbackSrc?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  sizes?: string;
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
  fallbackSrc,
  objectFit = 'cover',
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Normalize the source URL to ensure it uses the render endpoint
  const normalizedSrc = useMemo(() => normalizeStorageUrl(src), [src]);
  
  // Also normalize fallback URL if provided
  const normalizedFallbackSrc = useMemo(() => 
    fallbackSrc ? normalizeStorageUrl(fallbackSrc) : undefined
  , [fallbackSrc]);
  
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: isGalleryImage ? '200px' : '100px',
    threshold: 0.1,
  });

  const handleLoad = () => {
    requestAnimationFrame(() => {
      setIsLoaded(true);
      onLoad?.();
    });
  };

  const handleError = () => {
    setHasError(true);
    if (normalizedFallbackSrc && normalizedSrc !== normalizedFallbackSrc) {
      const img = document.querySelector(`img[src="${normalizedSrc}"]`) as HTMLImageElement;
      if (img) {
        img.src = normalizedFallbackSrc;
      }
    }
    onError?.();
  };

  const objectFitClass = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
    none: 'object-none',
    'scale-down': 'object-scale-down',
  }[objectFit];

  return (
    <div 
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={{
        aspectRatio: width && height ? `${width}/${height}` : 'auto',
      }}
    >
      {(inView || priority) && (
        <img
          src={normalizedSrc}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : propLoading || 'lazy'}
          className={`transition-opacity duration-300 ease-out will-change-opacity ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } w-full h-full ${objectFitClass}`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      
      {!isLoaded && !hasError && (
        <div 
          className="absolute inset-0 bg-gray-100 animate-pulse"
          style={{
            aspectRatio: width && height ? `${width}/${height}` : 'auto',
          }}
        />
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <span className="text-gray-500">Failed to load image</span>
        </div>
      )}
    </div>
  );
} 