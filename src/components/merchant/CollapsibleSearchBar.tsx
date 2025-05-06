import { useState } from 'react';
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
  
  const handleExpandSearch = () => {
    setIsExpanded(true);
  };
  
  const handleCloseSearch = () => {
    setIsExpanded(false);
  };
  
  const handleClearSearch = () => {
    onSearchChange('');
  };
  
  return (
    <div className="relative">
      {/* Mobile: Collapsed search icon button */}
      {!isExpanded && (
        <button
          onClick={handleExpandSearch}
          className="md:hidden flex items-center justify-center bg-gray-800 hover:bg-gray-700 transition-colors rounded-lg p-2.5"
          aria-label="Search"
        >
          <Search className="h-5 w-5 text-gray-300" />
        </button>
      )}
      
      {/* Mobile: Expanded search input */}
      {isExpanded && (
        <div className="md:hidden absolute inset-0 z-20 bg-gray-900 rounded-lg flex items-center pr-1">
          <Search className="absolute left-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-full bg-transparent rounded-lg pl-9 pr-16 py-2.5 text-sm focus:outline-none"
            autoFocus
          />
          <div className="absolute right-1 flex items-center">
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
              className="ml-1 bg-gray-800 hover:bg-gray-700 text-gray-300 p-1.5 rounded-md"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      
      {/* Desktop: Always visible search input */}
      <div className="hidden md:block relative w-full">
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
    </div>
  );
} 