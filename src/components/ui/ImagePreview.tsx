import React from 'react';
import { OptimizedImage } from './OptimizedImage';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  className?: string;
}

export function ImagePreview({ src, alt = 'Preview', className = '' }: ImagePreviewProps) {
  return (
    <div className={`relative aspect-square rounded-lg overflow-hidden bg-gray-800 ${className}`}>
      <OptimizedImage
        src={src}
        alt={alt}
        width={400}
        height={400}
        quality={75}
        className="w-full h-full"
      />
    </div>
  );
}