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

// WebP support detection and URL optimization functions have been removed
// as they're no longer used with our new image validation approach

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
  // Validate and normalize the source URL
  const optimizedSrc = useMemo(() => {
    // First use our validateImageUrl to normalize Supabase URLs
    let normalizedUrl = validateImageUrl(src);
    
    // If it's a Supabase storage URL, ensure proper endpoint usage
    if (normalizedUrl.includes('supabase') && normalizedUrl.includes('/storage/v1/')) {
      const isWebp = normalizedUrl.includes('.webp');
      const hasDashPattern = normalizedUrl.includes('-d');
      const isLogo = normalizedUrl.includes('logo');
      const isPng = normalizedUrl.endsWith('.png');
      const isJpg = normalizedUrl.endsWith('.jpg') || normalizedUrl.endsWith('.jpeg');
      
      // Use object endpoint for WebP, dash-pattern files, logos, and non-jpg/png files
      if (isWebp || hasDashPattern || isLogo || (!isPng && !isJpg)) {
        normalizedUrl = normalizedUrl
          .replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
      }
      
      // Add optimization parameters for render endpoint
      if (normalizedUrl.includes('/storage/v1/render/')) {
        const hasParams = normalizedUrl.includes('?');
        const separator = hasParams ? '&' : '?';
        normalizedUrl = `${normalizedUrl}${separator}width=${width}&quality=80&format=webp&cache=604800`;
      }
    }
    
    return normalizedUrl;
  }, [src, width]);

  // Only consider real high-priority images for eager loading
  // This helps avoid too many concurrent image loads
  const shouldPrioritize = priority || (isLCPCandidate(priority, width, height) && width > 600);
  const [isLoading, setIsLoading] = useState(!shouldPrioritize);
  const isLCP = isLCPCandidate(priority, width, height);
  
  // Determine proper loading strategy based on importance
  // More conservative eager loading to prevent too many concurrent requests
  const loadingStrategy = propLoading || (shouldPrioritize ? 'eager' : 'lazy');
  const fetchPriorityValue = propFetchPriority || getFetchPriority(isLCP, priority, inViewport);

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
      img.crossOrigin = 'anonymous';
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
          className="absolute inset-0 bg-gradient-to-tr from-gray-800 to-gray-700 animate-pulse" 
          style={{
            ...containerStyle,
            backgroundSize: '200% 200%',
            animationDuration: '1.5s',
          }}
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
        crossOrigin="anonymous"
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