import React, { useState } from 'react';

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

  // Simple URL optimization
  const optimizedSrc = src.includes('/storage/v1/object/public/')
    ? src.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') +
      `?width=${width}&quality=${quality}`
    : src;

  const handleImageError = () => {
    // If render endpoint fails, fall back to original URL
    if (src.includes('/storage/v1/render/image/public/')) {
      const img = document.querySelector(`img[src="${optimizedSrc}"]`) as HTMLImageElement;
      if (img) {
        img.src = src.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
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