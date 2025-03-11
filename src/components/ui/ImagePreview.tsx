import { Trash2 } from 'lucide-react';
import { OptimizedImage } from './OptimizedImage';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  className?: string;
  onRemove?: () => void;
}

export function ImagePreview({ src, alt = 'Preview', className = '', onRemove }: ImagePreviewProps) {
  return (
    <div className={`relative aspect-square rounded-lg overflow-hidden bg-gray-800 group ${className}`}>
      <OptimizedImage
        src={src}
        alt={alt}
        width={400}
        height={400}
        quality={75}
        className="w-full h-full object-contain"
      />
      {onRemove && (
        <div 
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="p-2 bg-red-500/90 rounded-full text-white hover:bg-red-600 transition-colors z-10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}