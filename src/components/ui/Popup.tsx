import { X } from 'lucide-react';

type PopupProps = {
  content: string;
  headerImageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  onClose: () => void;
};

export function Popup({ content, headerImageUrl, ctaText, ctaLink, onClose }: PopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 sm:p-6">
      <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-xl max-w-lg w-full mx-auto animate-fade-in">
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 z-10 text-gray-400 hover:text-white bg-black/20 rounded-full p-1 transition-colors"
          aria-label="Close popup"
        >
          <X className="h-5 w-5" />
        </button>
        
        {headerImageUrl && (
          <div className="w-full aspect-video bg-gray-800 relative">
            <img 
              src={headerImageUrl} 
              alt="Popup header" 
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="p-5 sm:p-6">
          <div className="prose prose-invert prose-sm sm:prose">
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
          
          {ctaText && ctaLink && (
            <div className="mt-6 text-center">
              <a
                href={ctaLink}
                className="inline-block bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-5 py-2.5 font-medium transition-colors"
              >
                {ctaText}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 