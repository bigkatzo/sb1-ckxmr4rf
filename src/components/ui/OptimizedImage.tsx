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
}

export function OptimizedImage({
  src,
  alt,
  width = 800,
  height,
  quality = 80,
  className = '',
  objectFit = 'cover',
  priority = false,
  onLoad,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(!priority);
  const [imageSrc, setImageSrc] = useState<string>('');

  useEffect(() => {
    // Reset loading state when src changes
    if (!priority) {
      setIsLoading(true);
    }
    
    // Optimize the image URL
    const optimizeImageUrl = (url: string) => {
      if (!url) return '';
      
      try {
        // Check if this is a Supabase URL that can be optimized
        if (url.includes('/storage/v1/render/image/')) {
          // Add width and quality parameters for resizing
          const params = new URLSearchParams();
          if (width) params.append('width', width.toString());
          if (height) params.append('height', height.toString());
          params.append('quality', quality.toString());
          
          // Add a timestamp to bust cache during development
          if (process.env.NODE_ENV === 'development') {
            params.append('t', Date.now().toString());
          }
          
          return `${url}?${params.toString()}`;
        }
        return url;
      } catch (error) {
        console.error('Error optimizing image URL:', error);
        return url;
      }
    };
    
    setImageSrc(optimizeImageUrl(src));
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
      
      <img
        src={imageSrc}
        alt={alt}
        className={`${objectFitClass} transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${className}`}
        loading={priority ? 'eager' : 'lazy'}
        onLoad={handleImageLoad}
        onError={() => {
          console.error('Image failed to load:', src);
          setIsLoading(false);
        }}
        {...props}
      />
    </div>
  );
} 