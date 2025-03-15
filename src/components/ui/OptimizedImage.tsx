import React, { useState, useMemo } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  className?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  priority?: boolean;
  onLoad?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width = 800,
  height,
  quality = 75,
  className = '',
  objectFit = 'cover',
  priority = false,
  onLoad,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(!priority);

  // Enhanced URL optimization with caching
  const optimizedSrc = useMemo(() => {
    if (src.includes('/storage/v1/object/public/')) {
      // For Supabase storage URLs, add render endpoint and caching params
      const baseUrl = src.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
      const params = new URLSearchParams({
        width: width.toString(),
        quality: quality.toString(),
        cache: '604800' // 1 week cache
      });
      return `${baseUrl}?${params.toString()}`;
    }
    return src;
  }, [src, width, quality]);

  const handleImageError = () => {
    // If render endpoint fails, fall back to original URL with cache control
    if (src.includes('/storage/v1/render/image/public/')) {
      const fallbackUrl = new URL(src.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/'));
      fallbackUrl.searchParams.set('cache', '604800'); // 1 week cache
      const img = document.querySelector(`img[src="${optimizedSrc}"]`) as HTMLImageElement;
      if (img) {
        img.src = fallbackUrl.toString();
      }
    }
    setIsLoading(false);
  };

  const objectFitClass = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
    none: 'object-none',
    'scale-down': 'object-scale-down',
  }[objectFit];

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse" />
      )}
      
      <img
        src={optimizedSrc}
        alt={alt}
        width={width}
        height={height}
        className={`
          w-full h-full ${objectFitClass} 
          transition-all duration-300 ease-out
          ${isLoading ? 'scale-105 blur-[1px]' : 'scale-100 blur-0'}
          ${className}
        `}
        loading={priority ? 'eager' : 'lazy'}
        onLoad={() => {
          setIsLoading(false);
          if (onLoad) onLoad();
        }}
        onError={handleImageError}
        {...props}
      />
    </div>
  );
} 