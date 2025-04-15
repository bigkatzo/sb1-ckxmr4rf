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
  inViewport?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  loading?: 'eager' | 'lazy';
}

// Helper to detect if image is an LCP candidate based on attributes
const isLCPCandidate = (priority: boolean, width?: number, height?: number): boolean => {
  return priority || (!!width && width >= 800 && !!height && height >= 600);
};

// Get proper fetch priority based on image importance
const getFetchPriority = (
  isLCP: boolean, 
  priority: boolean, 
  inViewport?: boolean
): 'high' | 'low' | 'auto' => {
  if (isLCP || priority) return 'high';
  if (inViewport) return 'high';
  return 'auto';
};

// Feature detection for WebP support
let webpSupportCache: boolean | null = null;

// Check if browser supports WebP
const supportsWebP = (): boolean => {
  // Return cached result if available
  if (webpSupportCache !== null) return webpSupportCache;
  
  // SSR guard
  if (typeof window === 'undefined') return false;
  
  // Try to get cached value from localStorage
  try {
    const cached = window.localStorage?.getItem('webp_support');
    if (cached !== null) {
      webpSupportCache = cached === 'true';
      return webpSupportCache;
    }
  } catch (e) {
    // Ignore storage errors
  }
  
  // Simple feature detection
  const canvas = document.createElement('canvas');
  if (canvas.getContext && canvas.getContext('2d')) {
    // Check if the browser can encode WebP
    webpSupportCache = canvas.toDataURL('image/webp').startsWith('data:image/webp');
    
    // Cache the result
    try {
      window.localStorage?.setItem('webp_support', webpSupportCache.toString());
    } catch (e) {
      // Ignore storage errors
    }
    
    return webpSupportCache;
  }
  
  // Default to false
  webpSupportCache = false;
  return false;
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
  inViewport = false,
  fetchPriority: propFetchPriority,
  loading: propLoading,
  ...props
}: OptimizedImageProps) {
  // Only consider real high-priority images for eager loading
  // This helps avoid too many concurrent image loads
  const shouldPrioritize = priority || (isLCPCandidate(priority, width, height) && width > 600);
  const [isLoading, setIsLoading] = useState(!shouldPrioritize);
  const isLCP = isLCPCandidate(priority, width, height);
  
  // Determine proper loading strategy based on importance
  // More conservative eager loading to prevent too many concurrent requests
  const loadingStrategy = propLoading || (shouldPrioritize ? 'eager' : 'lazy');
  const fetchPriorityValue = propFetchPriority || getFetchPriority(isLCP, priority, inViewport);

  // Enhanced URL optimization with caching and format conversion
  const optimizedSrc = useMemo(() => {
    if (src.includes('/storage/v1/object/public/')) {
      // For Supabase storage URLs, add render endpoint with format and size params
      const baseUrl = src.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
      
      // Determine if we should convert format to WebP
      let format = '';
      
      // Skip format conversion for images that might have transparency unless they're PNGs
      const mightHaveTransparency = 
        src.toLowerCase().includes('transparent') || 
        src.toLowerCase().includes('alpha') || 
        src.toLowerCase().includes('logo');
      
      const isPng = src.toLowerCase().endsWith('.png');
      const isJpg = src.toLowerCase().match(/\.(jpg|jpeg)$/i) !== null;
      
      // Only attempt format conversion for larger images (>400px) and if browser supports WebP
      // Supabase storage only supports WebP conversion
      if (width > 200 && (typeof window === 'undefined' || supportsWebP())) {
        // Convert JPGs or PNGs without transparency to WebP
        if (isJpg || (isPng && !mightHaveTransparency)) {
          format = 'webp';
        }
      }

      // Add responsive size parameter for large images
      let optimalWidth = width;
      if (width > 1000 && !priority) {
        // Use a more reasonable size for non-priority images
        optimalWidth = Math.min(width, 1000);
      } else if (width > 1500 && priority) {
        // Even for priority images, cap the size to avoid excessive data
        optimalWidth = Math.min(width, 1500);
      }

      const params = new URLSearchParams({
        width: optimalWidth.toString(),
        quality: priority ? quality.toString() : Math.min(quality, 80).toString(),
        cache: '604800' // 1 week cache
      });
      
      if (format) params.append('format', format);
      
      return `${baseUrl}?${params.toString()}`;
    }
    return src;
  }, [src, width, quality, priority]);

  // Only generate responsive sizes if explicitly not provided by the parent component
  // This ensures we don't override specific sizing requirements in different components
  const responsiveSizes = sizes || 
    (width && height ? `(max-width: 640px) ${Math.min(width, 640)}px, ${width}px` : '100vw');

  // Improved preload logic for high priority images
  useEffect(() => {
    // Only preload images that are truly important - limit to absolute priorities
    const shouldPreload = (isLCP || priority) && typeof window !== 'undefined';
    
    if (shouldPreload && !document.querySelector(`link[rel="preload"][href="${optimizedSrc}"]`)) {
      const linkEl = document.createElement('link');
      linkEl.rel = 'preload';
      linkEl.as = 'image';
      linkEl.href = optimizedSrc;
      linkEl.fetchPriority = 'high';
      
      // Add sizes and type hints if available to improve browser loading
      if (sizes) {
        linkEl.setAttribute('imagesizes', sizes);
      }
      
      // Add preload to document head
      document.head.appendChild(linkEl);
      
      return () => {
        // Only attempt to remove if the element still exists
        const existingLink = document.querySelector(`link[rel="preload"][href="${optimizedSrc}"]`);
        if (existingLink && existingLink.parentNode) {
          existingLink.parentNode.removeChild(existingLink);
        }
      };
    }
  }, [optimizedSrc, isLCP, priority, sizes]);

  const handleImageError = () => {
    // If render endpoint fails, fall back to original URL with cache control
    if (src.includes('/storage/v1/render/image/public/')) {
      const fallbackUrl = new URL(src.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/'));
      
      // Set cache control for the fallback URL
      fallbackUrl.searchParams.set('cache', '604800'); // 1 week cache
      
      // Fall back to original format
      console.warn(`Image conversion failed for ${optimizedSrc}, using original format`);
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
        loading={loadingStrategy}
        fetchPriority={fetchPriorityValue}
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