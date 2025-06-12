import { Eye, X } from 'lucide-react';
import { isPreviewMode, clearPreviewCache } from '../../utils/preview';

interface PreviewBannerProps {
  onClose?: () => void;
}

export function PreviewBanner({ onClose }: PreviewBannerProps) {
  if (!isPreviewMode()) {
    return null;
  }

  const handleClose = async () => {
    try {
      // Clear preview cache before removing the parameter
      await clearPreviewCache();
      
      // Remove preview parameter and force a full page reload
      const url = new URL(window.location.href);
      url.searchParams.delete('preview');
      window.location.replace(url.toString());
    } catch (err) {
      console.error('Error exiting preview mode:', err);
      // If cache clearing fails, still try to exit preview mode
      const url = new URL(window.location.href);
      url.searchParams.delete('preview');
      window.location.replace(url.toString());
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] animate-fade-in">
      <div className="bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/20 rounded-full shadow-lg">
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex items-center gap-2 text-yellow-300">
            <Eye className="h-4 w-4" />
            <span className="text-sm font-medium whitespace-nowrap">
              Preview Mode
            </span>
          </div>
          <button
            onClick={onClose || handleClose}
            className="text-yellow-300 hover:text-yellow-100 transition-colors p-1 hover:bg-yellow-500/10 rounded-full"
            aria-label="Exit preview mode"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
} 