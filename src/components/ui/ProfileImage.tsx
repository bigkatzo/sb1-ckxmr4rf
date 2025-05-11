import { useState } from 'react';

// Default placeholder as colored initial
const DEFAULT_INITIAL = 'A'; // 'A' for Anonymous

export interface ProfileImageProps {
  src: string | null | undefined;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  displayName?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * A simple profile image component that falls back to initials
 */
export function ProfileImage({
  src,
  alt,
  size = 'md',
  displayName,
  className = '',
  onClick,
}: ProfileImageProps) {
  const [imageError, setImageError] = useState(false);
  
  // Map size to dimensions
  const sizeMap = {
    xs: { width: 24, height: 24, fontSize: 'text-[8px]' },
    sm: { width: 32, height: 32, fontSize: 'text-[10px]' },
    md: { width: 40, height: 40, fontSize: 'text-xs' },
    lg: { width: 48, height: 48, fontSize: 'text-sm' },
    xl: { width: 64, height: 64, fontSize: 'text-lg' }
  };
  
  const { width, height, fontSize } = sizeMap[size];
  
  // Get initial letter from display name
  const initial = displayName ? displayName.charAt(0).toUpperCase() : DEFAULT_INITIAL;
  
  // Determine if we should show the image or fallback
  const showImage = src && !imageError;
  
  // Container classes for consistent styling
  const containerClasses = `
    relative flex-shrink-0 overflow-hidden rounded-full
    ${className}
    ${onClick ? 'cursor-pointer' : ''}
  `;
  
  // Convert object URL to direct URL if it's a Supabase storage URL
  // This fixes the most common issue with profile images
  let imageUrl: string | undefined = undefined;
  if (src && src.includes('supabase') && src.includes('/storage/v1/render/image/public/')) {
    imageUrl = src.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/').split('?')[0];
  } else if (src) {
    imageUrl = src;
  }
  
  return (
    <div 
      className={containerClasses}
      style={{ width: `${width}px`, height: `${height}px` }}
      onClick={onClick}
    >
      {showImage && imageUrl ? (
        // Simple direct image with error handling
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
          loading="eager"
          crossOrigin="anonymous"
        />
      ) : (
        // Fallback to display initial in styled container
        <div className={`
          h-full w-full flex items-center justify-center
          text-white/70 bg-white/20 ${fontSize}
        `}>
          {initial}
        </div>
      )}
    </div>
  );
} 