import { Eye, X } from 'lucide-react';
import { isPreviewMode } from '../../utils/preview';

interface PreviewBannerProps {
  onClose?: () => void;
}

export function PreviewBanner({ onClose }: PreviewBannerProps) {
  if (!isPreviewMode()) {
    return null;
  }

  const handleClose = () => {
    // Remove preview parameter and reload
    const url = new URL(window.location.href);
    url.searchParams.delete('preview');
    window.location.href = url.toString();
  };

  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 text-yellow-300">
          <Eye className="h-4 w-4" />
          <span className="text-sm font-medium">
            Preview Mode
          </span>
          <span className="text-xs text-yellow-300/80">
            You're viewing hidden/unpublished content
          </span>
        </div>
        <button
          onClick={onClose || handleClose}
          className="text-yellow-300 hover:text-yellow-100 transition-colors p-1"
          aria-label="Exit preview mode"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
} 