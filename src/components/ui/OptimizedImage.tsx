import React, { useState, useEffect } from 'react';

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
  sizes = '100vw',
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(!priority);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [srcSet, setSrcSet] = useState<string>('');

  useEffect(() => {
    // Reset loading state when src changes
    if (!priority) {
      setIsLoading(true);
    }
    
    // Optimize the image URL
    const optimizeImageUrl = (url: string, targetWidth?: number, targetQuality?: number) => {
      if (!url) return '';
      
      try {
        // Check if this is a Supabase URL that can be optimized
        if (url.includes('/storage/v1/object/public/')) {
          // Convert object URL to render URL
          const renderUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
          
          // Add width, height, and quality parameters for resizing
          const params = new URLSearchParams();
          
          if (targetWidth) {
            params.append('width', targetWidth.toString());
            // Calculate height proportionally if original height is provided
            if (height && width) {
              const aspectRatio = height / width;
              const targetHeight = Math.round(targetWidth * aspectRatio);
              params.append('height', targetHeight.toString());
            }
          } else if (width) {
            params.append('width', width.toString());
            if (height) params.append('height', height.toString());
          }
          
          // Add quality parameter
          params.append('quality', (targetQuality || quality).toString());
          
          // Add format parameter for WebP if supported
          params.append('format', 'webp');
          
          // Add a timestamp to bust cache during development
          if (process.env.NODE_ENV === 'development') {
            params.append('t', Date.now().toString());
          }
          
          return `${renderUrl}?${params.toString()}`;
        }
        return url;
      } catch (error) {
        console.error('Error optimizing image URL:', error);
        return url;
      }
    };
    
    // Generate srcSet for responsive images
    const generateSrcSet = () => {
      const widths = [320, 640, 768, 1024, 1280, 1536, 1920];
      const srcSetEntries = widths
        .filter(w => !width || w <= width * 2) // Don't generate sizes larger than 2x the target width
        .map(w => {
          const optimizedUrl = optimizeImageUrl(src, w, w < 640 ? quality - 10 : quality); // Lower quality for small screens
          return `${optimizedUrl} ${w}w`;
        });
      return srcSetEntries.join(', ');
    };

    setImageSrc(optimizeImageUrl(src));
    setSrcSet(generateSrcSet());
  }, [src, width, height, quality, priority]);

  const handleImageLoad = () => {
    setIsLoading(false);
    if (onLoad) onLoad();
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
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm">
          <div className="w-10 h-10 border-4 border-gray-600 border-t-purple-500 rounded-full animate-spin"></div>
        </div>
      )}
      
      <picture>
        {/* WebP format for modern browsers */}
        <source
          type="image/webp"
          srcSet={srcSet}
          sizes={sizes}
        />
        {/* Fallback for browsers that don't support WebP */}
        <img
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          className={`w-full h-full ${objectFitClass} transition-opacity duration-300 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          } ${className}`}
          loading={priority ? 'eager' : 'lazy'}
          onLoad={handleImageLoad}
          onError={() => {
            console.error('Image failed to load:', src);
            setIsLoading(false);
          }}
          sizes={sizes}
          srcSet={srcSet}
          {...props}
        />
      </picture>
    </div>
  );
} 