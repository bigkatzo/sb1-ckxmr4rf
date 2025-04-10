import React, { useState, useMemo, useEffect } from 'react';

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
  sizes?: string;
}

// Helper to detect if image is an LCP candidate based on attributes
const isLCPCandidate = (priority: boolean, width?: number, height?: number): boolean => {
  return priority || (!!width && width >= 800 && !!height && height >= 600);
};

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
  sizes,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(!priority);
  const isLCP = isLCPCandidate(priority, width, height);

  // Enhanced URL optimization with caching and format conversion
  const optimizedSrc = useMemo(() => {
    if (src.includes('/storage/v1/object/public/')) {
      // For Supabase storage URLs, add render endpoint with format and size params
      const baseUrl = src.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
      
      // Only convert to WebP if it's a larger image (>400px) and not likely transparent
      // This conservative approach ensures we don't change the visual appearance of UI elements
      const shouldConvertFormat = width > 400 && 
        src.toLowerCase().endsWith('.png') && 
        !src.toLowerCase().includes('transparent');
      
      const format = shouldConvertFormat ? 'webp' : '';

      const params = new URLSearchParams({
        width: width.toString(),
        quality: quality.toString(),
        cache: '604800' // 1 week cache
      });
      
      if (format) params.append('format', format);
      
      return `${baseUrl}?${params.toString()}`;
    }
    return src;
  }, [src, width, quality]);

  // Only generate responsive sizes if explicitly not provided by the parent component
  // This ensures we don't override specific sizing requirements in different components
  const responsiveSizes = sizes || 
    (width && height ? `(max-width: 640px) ${Math.min(width, 640)}px, ${width}px` : '100vw');

  // Preload LCP image only for actual LCP candidates, not smaller UI elements
  useEffect(() => {
    if (isLCP && typeof window !== 'undefined') {
      const linkEl = document.createElement('link');
      linkEl.rel = 'preload';
      linkEl.as = 'image';
      linkEl.href = optimizedSrc;
      linkEl.fetchPriority = 'high';
      document.head.appendChild(linkEl);
      
      return () => {
        document.head.removeChild(linkEl);
      };
    }
  }, [optimizedSrc, isLCP]);

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
        <div 
          className="absolute inset-0 bg-gray-800 animate-pulse" 
          style={height && width ? { aspectRatio: `${width}/${height}` } : undefined}
        />
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
        fetchPriority={isLCP ? 'high' : 'auto'}
        sizes={responsiveSizes}
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