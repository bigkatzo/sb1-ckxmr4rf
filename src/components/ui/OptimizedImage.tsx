import React, { useState, useMemo, useEffect } from 'react';
import { validateImageUrl } from '../../utils/imageValidator';

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

// Feature detection for WebP support is implemented but not currently used
// Kept for potential future use with explicit feature flag
/* 
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
*/

// Helper to generate optimized URLs
function generateOptimizedUrl(
  src: string, 
  _width?: number, // Unused but kept for API consistency
  _quality?: number // Unused but kept for API consistency
): string {
  if (!src) return '';
  
  // Already validate/fix the URL with our robust fix
  const validatedUrl = validateImageUrl(src);
  
  // If the URL is already validated, just return it
  return validatedUrl;
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

  // Optimize the source URL for performance
  const optimizedSrc = useMemo(() => {
    return generateOptimizedUrl(src, width, quality);
  }, [src, width, quality]);

  // Only generate responsive sizes if explicitly not provided by the parent component
  // This ensures we don't override specific sizing requirements in different components
  const responsiveSizes = sizes || 
    (width && height ? `(max-width: 640px) ${Math.min(width, 640)}px, ${width}px` : '100vw');

  // Improved preload logic for high priority images
  useEffect(() => {
    // Only preload images that are truly important - limit to absolute priorities
    const shouldPreload = (isLCP || priority) && typeof window !== 'undefined';
    
    if (shouldPreload && !document.querySelector(`link[rel="preload"][href="${optimizedSrc}"]`)) {
      // For very important images, add preload link in document head
      const linkEl = document.createElement('link');
      linkEl.rel = 'preload';
      linkEl.as = 'image';
      linkEl.href = optimizedSrc;
      linkEl.fetchPriority = 'high';
      linkEl.crossOrigin = 'anonymous';
      
      // Add sizes and type hints if available to improve browser loading
      if (sizes) {
        linkEl.setAttribute('imagesizes', sizes);
      }
      
      // When preloading product images, inject at top of head for highest priority
      if (src.includes('product-images')) {
        document.head.insertBefore(linkEl, document.head.firstChild);
      } else {
        // Otherwise just append to head
        document.head.appendChild(linkEl);
      }
      
      // Also directly fetch for Safari and other browsers with limited support
      const img = new Image();
      img.src = optimizedSrc;
      img.fetchPriority = 'high';
      if (sizes) img.sizes = sizes;
      
      return () => {
        // Only attempt to remove if the element still exists
        const existingLink = document.querySelector(`link[rel="preload"][href="${optimizedSrc}"]`);
        if (existingLink && existingLink.parentNode) {
          existingLink.parentNode.removeChild(existingLink);
        }
      };
    }
  }, [optimizedSrc, isLCP, priority, sizes, src]);

  const handleImageError = () => {
    console.warn(`Image load failed for ${optimizedSrc}`);
    
    try {
      // Try different strategies to recover from image load failures
      let fallbackUrl: URL | null = null;
      let imgElement = document.querySelector(`img[src="${optimizedSrc}"]`) as HTMLImageElement;
      
      if (!imgElement) {
        // If we can't find the image element, stop further processing
        setIsLoading(false);
        return;
      }
      
      // Strategy 1: If we're using render endpoint with params, try without params
      if (optimizedSrc.includes('/storage/v1/render/image/public/') && optimizedSrc.includes('?')) {
        const baseUrl = optimizedSrc.split('?')[0];
        console.log('Trying render endpoint without params:', baseUrl);
        imgElement.src = baseUrl;
        return; // Exit and wait for potential second error
      }
      
      // Strategy 2: If we're using render endpoint without params, try object endpoint
      if (optimizedSrc.includes('/storage/v1/render/image/public/') && !optimizedSrc.includes('?')) {
        fallbackUrl = new URL(optimizedSrc.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/'));
        console.log('Trying object endpoint:', fallbackUrl.toString());
        imgElement.src = fallbackUrl.toString();
        return; // Exit and wait for potential third error
      }
      
      // Strategy 3: For older URLs directly using object endpoint, try the render endpoint
      if (optimizedSrc.includes('/storage/v1/object/public/')) {
        fallbackUrl = new URL(optimizedSrc.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/'));
        console.log('Trying render endpoint from object URL:', fallbackUrl.toString());
        imgElement.src = fallbackUrl.toString();
        return;
      }
      
      // Final fallback: Try loading the original src directly if it's different from the optimized src
      if (src !== optimizedSrc) {
        console.log('Final fallback to original URL:', src);
        imgElement.src = src;
      }
    } catch (error) {
      console.error('Error in image fallback:', error);
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

  // Calculate aspect ratio for placeholder
  const aspectRatio = height && width ? `${width}/${height}` : undefined;
  const containerStyle = aspectRatio ? { aspectRatio } : undefined;
  
  // Special handling for logo images
  const isLogo = src.includes('logo.svg') || src.includes('logo-icon.svg');
  const logoStyle = isLogo ? { 
    padding: 0,
    margin: 0,
    display: 'block', 
    height: '100%',
    objectPosition: 'left center',
    pointerEvents: 'none' as const
  } : {};

  return (
    <div 
      className={`relative w-full h-full overflow-hidden ${isLogo ? 'p-0 m-0 pointer-events-none max-w-fit' : ''}`}
      style={containerStyle}
    >
      {isLoading && !isLogo && (
        <div 
          className="absolute inset-0 bg-gray-800 animate-pulse" 
          style={containerStyle}
        />
      )}
      
      <img
        src={optimizedSrc}
        alt={alt}
        width={width}
        height={height}
        className={`
          w-full h-full ${objectFitClass} 
          transition-opacity duration-300 ease-out
          ${isLoading ? 'opacity-0' : 'opacity-100'}
          ${className}
        `}
        loading={loadingStrategy}
        fetchPriority={fetchPriorityValue}
        sizes={responsiveSizes}
        style={{...containerStyle, ...logoStyle, ...(props.style || {})}}
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