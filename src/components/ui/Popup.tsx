import { X } from 'lucide-react';
import { useEffect } from 'react';

type PopupProps = {
  content: string;
  headerImageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
  onClose: () => void;
};

export function Popup({ content, headerImageUrl, ctaText, ctaLink, onClose }: PopupProps) {
  // Prevent scrolling when popup is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 p-4 sm:p-6 backdrop-blur-sm">
      <div 
        className="relative bg-gradient-to-b from-gray-900 to-gray-950 rounded-xl overflow-hidden shadow-2xl max-w-lg w-full mx-auto animate-fade-in border border-gray-800/50"
        style={{
          boxShadow: '0 0 40px rgba(139, 92, 246, 0.15), 0 0 15px rgba(139, 92, 246, 0.1)'
        }}
      >
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-10 text-gray-400 hover:text-white bg-black/30 hover:bg-black/50 rounded-full p-1.5 transition-all duration-200 shadow-md"
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
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent"></div>
          </div>
        )}
        
        <div className="p-6 sm:p-7">
          <div className="prose prose-invert prose-sm sm:prose max-w-none">
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
          
          {ctaText && ctaLink && (
            <div className="mt-7 text-center">
              <a
                href={ctaLink}
                className="inline-block bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg px-6 py-3 font-medium transition-all duration-200 transform hover:scale-105 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 focus:outline-none shadow-lg animate-glow"
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