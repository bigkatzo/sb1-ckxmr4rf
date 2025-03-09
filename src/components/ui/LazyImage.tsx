import React from 'react';
import { useInView } from '../../hooks/useInView';
import { OptimizedImage } from './OptimizedImage';

interface LazyImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  loadingClassName?: string;
  lowQualityUrl?: string;
  quality?: number;
  sizes?: string;
  priority?: boolean;
}

export function LazyImage({
  src,
  alt,
  width,
  height,
  className = '',
  loadingClassName = '',
  lowQualityUrl,
  ...props
}: LazyImageProps) {
  const { ref, isInView, hasBeenInView } = useInView<HTMLDivElement>({
    rootMargin: '50px'
  });

  return (
    <div ref={ref} className={`relative ${className}`}>
      {!hasBeenInView && lowQualityUrl && (
        <OptimizedImage
          src={lowQualityUrl}
          alt={alt}
          width={width}
          height={height}
          className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${loadingClassName}`}
          {...props}
        />
      )}
      {(isInView || hasBeenInView) && (
        <OptimizedImage
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={`w-full h-full ${hasBeenInView ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
          onLoad={() => {
            // Add a small delay to ensure smooth transition
            setTimeout(() => {
              const img = document.querySelector(`img[src="${src}"]`) as HTMLImageElement;
              if (img) {
                img.style.opacity = '1';
              }
            }, 50);
          }}
          {...props}
        />
      )}
    </div>
  );
} 