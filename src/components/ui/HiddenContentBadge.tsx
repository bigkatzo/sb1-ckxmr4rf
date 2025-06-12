import { EyeOff } from 'lucide-react';
import { isPreviewMode } from '../../utils/preview';

interface HiddenContentBadgeProps {
  isVisible?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function HiddenContentBadge({ 
  isVisible = true, 
  className = '', 
  size = 'sm' 
}: HiddenContentBadgeProps) {
  // Only show the badge if content is hidden AND we're in preview mode
  if (isVisible || !isPreviewMode()) {
    return null;
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4'
  };

  return (
    <span 
      className={`
        inline-flex items-center gap-1 rounded-full 
        bg-gray-800/80 text-gray-300 font-medium
        border border-gray-600/50
        ${sizeClasses[size]}
        ${className}
      `}
    >
      <EyeOff className={iconSizes[size]} />
      Hidden
    </span>
  );
} 