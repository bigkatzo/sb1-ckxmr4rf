import React, { useState } from 'react';
import { useInView } from 'react-intersection-observer';

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
    if (fallbackSrc && src !== fallbackSrc) {
      const img = document.querySelector(`img[src="${src}"]`) as HTMLImageElement;
      if (img) {
        img.src = fallbackSrc;
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
          src={src}
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