import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface CollapsibleSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder: string;
}

export function CollapsibleSearchBar({
  searchQuery,
  onSearchChange,
  placeholder
}: CollapsibleSearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const handleExpandSearch = () => {
    setIsExpanded(true);
  };
  
  const handleCloseSearch = () => {
    setIsExpanded(false);
  };
  
  const handleClearSearch = () => {
    onSearchChange('');
  };

  // Check viewport size to handle mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsExpanded(false); // Reset expanded state on desktop
      }
    };
    
    handleResize(); // Set initial state
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Handle clicks outside of the search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node) && isExpanded) {
        setIsExpanded(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);
  
  return (
    <div className="relative" ref={searchRef}>
      {/* Mobile: Collapsed search icon button */}
      {isMobile && !isExpanded && (
        <button
          onClick={handleExpandSearch}
          className="flex items-center justify-center bg-gray-800 hover:bg-gray-700 transition-colors rounded-lg p-2.5"
          aria-label="Search"
          title="Search"
        >
          <Search className="h-5 w-5 text-gray-300" />
          {searchQuery && (
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-white"></span>
          )}
        </button>
      )}
      
      {/* Mobile: Expanded search overlay */}
      {isMobile && isExpanded && (
        <>
          <div className="fixed inset-0 bg-black/50 z-10" onClick={handleCloseSearch}></div>
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-gray-900 rounded-lg shadow-lg border border-gray-700 p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={placeholder}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-gray-800 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm border border-gray-700"
                autoFocus
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="p-1 text-gray-400 hover:text-gray-300"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={handleCloseSearch}
                  className="ml-1 text-gray-400 hover:text-gray-300"
                  aria-label="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Desktop: Always visible search input */}
      {!isMobile && (
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-gray-800 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm border border-gray-700 hover:border-gray-600 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-300"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
} 