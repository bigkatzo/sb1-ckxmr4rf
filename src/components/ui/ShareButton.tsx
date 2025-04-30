import { Share2 } from 'lucide-react';
import { MouseEvent } from 'react';

interface ShareButtonProps {
  url?: string;
  title?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg'; 
}

export function ShareButton({ url, title, className = '', size = 'md' }: ShareButtonProps) {
  const shareUrl = url || window.location.href;
  const shareTitle = title || document.title;

  const handleShare = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent event from bubbling up to parent (important for cards)
    
    // Check if Web Share API is available (mainly mobile)
    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        url: shareUrl,
      }).catch(error => {
        console.error('Error sharing:', error);
        // Fallback to copy to clipboard
        copyToClipboard();
      });
    } else {
      // Fallback for desktop: copy to clipboard
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    try {
      navigator.clipboard.writeText(shareUrl);
      // Could add a toast notification here if you have a toast system
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  // Size variations
  const sizeClasses = {
    sm: 'p-1 text-xs',
    md: 'p-1.5 text-sm',
    lg: 'p-2 text-base'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4'
  };

  return (
    <button
      onClick={handleShare}
      className={`
        bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white 
        rounded-full transition-colors z-10 ${sizeClasses[size]} ${className}
      `}
      title="Share"
      aria-label="Share"
    >
      <Share2 className={iconSizes[size]} />
    </button>
  );
} 