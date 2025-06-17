import { useEffect, useState, useRef } from 'react';
import { ChevronDown, X, Filter, Search } from 'lucide-react';
import { useMerchantDashboard } from '../../contexts/MerchantDashboardContext';
import { useCategories } from '../../hooks/useCategories';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';

type FilterOption = {
  id: string;
  name: string;
  type?: string;
};

export function InlineFilterBar() {
  const { 
    selectedCollection, 
    selectedCategory,
    globalSearchQuery,
    setSelectedCollection, 
    setSelectedCategory,
    setGlobalSearchQuery,
    clearAllSelections 
  } = useMerchantDashboard();
  
  const { collections, loading: collectionsLoading } = useMerchantCollections();
  const { categories, loading: categoriesLoading } = useCategories(selectedCollection);
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<'collections' | 'categories' | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  
  // Get display values for selected items
  const selectedCollectionName = collections.find(c => c.id === selectedCollection)?.name;
  const selectedCategoryName = categories.find(c => c.id === selectedCategory)?.name;
  
  const hasActiveFilters = selectedCollection || selectedCategory || globalSearchQuery;
  
  // Close the dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveSubMenu(null);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Reset active submenu when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setActiveSubMenu(null);
    }
  }, [isOpen]);

  // Check viewport size to handle mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 768);
    };
    
    handleResize(); // Set initial state
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Handle option selection
  const handleOptionSelect = (optionType: 'collection' | 'category', optionId: string) => {
    if (optionType === 'collection') {
      // If clicking on the already selected collection, deselect it
      if (selectedCollection === optionId) {
        setSelectedCollection('');
        setSelectedCategory(''); // Also clear category selection when collection is deselected
      } else {
        setSelectedCollection(optionId);
      }
    } else {
      // If clicking on the already selected category, deselect it
      if (selectedCategory === optionId) {
        setSelectedCategory('');
      } else {
        setSelectedCategory(optionId);
      }
    }
    setIsOpen(false);
  };

  // Format options for rendering
  const renderOptions = (options: FilterOption[], type: 'collection' | 'category') => {
    if (options.length === 0) {
      return <div className={`px-3 py-2 text-sm text-gray-400 ${isCollapsed ? 'text-xs py-1.5' : ''}`}>No options available</div>;
    }
    
    return options.map((option) => (
      <button
        key={option.id}
        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 transition-colors ${
          (type === 'collection' && selectedCollection === option.id) || 
          (type === 'category' && selectedCategory === option.id)
            ? 'bg-gray-800/50 font-medium text-primary'
            : 'text-gray-300'
        } ${isCollapsed ? 'text-xs py-1.5' : ''}`}
        onClick={() => handleOptionSelect(type, option.id)}
      >
        {option.name}
      </button>
    ));
  };
  
  // Generate display text for the filter button
  const getFilterDisplayText = () => {
    const parts = [];
    if (globalSearchQuery) {
      parts.push(`"${globalSearchQuery.substring(0, 15)}${globalSearchQuery.length > 15 ? '...' : ''}"`);
    }
    if (selectedCollectionName) {
      parts.push(selectedCollectionName);
    }
    if (selectedCategoryName) {
      parts.push(selectedCategoryName);
    }
    
    if (parts.length === 0) return 'Global Filter';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts.join(' • ');
    return `${parts[0]} • +${parts.length - 1}`;
  };
  
  // Collapsed mobile view
  if (isCollapsed && !isOpen) {
    return (
      <div className="relative" ref={filterRef}>
        <div className="flex items-center">
          <button
            onClick={() => setIsOpen(true)}
            className={`
              inline-flex items-center justify-between gap-1 px-2 py-2 rounded-md text-xs shadow-sm w-full
              ${hasActiveFilters 
                ? 'bg-primary/10 border border-primary text-primary' 
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600'}
            `}
            aria-label="Filter"
            title={hasActiveFilters ? 'Active filters' : 'Filter'}
          >
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              <span className="font-medium truncate max-w-[150px]">
                {hasActiveFilters 
                  ? getFilterDisplayText()
                  : 'Filter'}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }
  
  // Expanded view (desktop or expanded mobile)
  return (
    <div className="relative flex-shrink-0 w-full md:w-auto" ref={filterRef}>
      {isCollapsed && isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setIsOpen(false)}></div>
      )}
      
      <div className="flex items-center">
        {/* Filter button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm border transition-colors shadow-sm
            ${hasActiveFilters 
              ? 'border-primary text-primary hover:bg-primary/10' 
              : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:bg-gray-800 hover:text-gray-300'}
          `}
        >
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="font-medium truncate max-w-[100px] md:max-w-[140px]">
              {getFilterDisplayText()}
            </span>
          </div>
          <ChevronDown className="h-4 w-4" />
        </button>
        
        {/* Clear button (only shown when filters are active and not on mobile) */}
        {hasActiveFilters && !isCollapsed && (
          <button
            onClick={clearAllSelections}
            className="ml-2 text-gray-500 hover:text-gray-300 transition-colors bg-gray-800 hover:bg-gray-700 p-1.5 rounded-md"
            title="Clear all filters"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className={`
          ${isCollapsed 
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-lg rounded-b-none'
            : 'absolute left-0 right-0 top-full mt-1 z-50 sm:right-auto sm:min-w-[280px]'
          }
          bg-gray-900 border border-gray-700 shadow-xl py-1 divide-y divide-gray-800
        `}>
          {isCollapsed && (
            <div className="sticky top-0 z-10 flex justify-between items-center px-3 py-2 border-b border-gray-800 bg-gray-900">
              <h3 className="text-xs font-medium text-gray-300">Filter Options</h3>
              <div className="flex items-center gap-2">
                {/* Clear button for mobile inside the dropdown header */}
                {hasActiveFilters && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAllSelections();
                      setIsOpen(false);
                    }}
                    className="text-red-400 hover:text-red-300 transition-colors bg-gray-800/80 hover:bg-gray-700 p-1 rounded-md flex items-center gap-1"
                    title="Clear all filters"
                  >
                    <X className="h-3 w-3" />
                    <span className="text-xs font-medium">Clear</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-300 transition-colors bg-gray-800/80 hover:bg-gray-700 p-1 rounded-md"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
          
          {/* Global Search Section */}
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search across all items..."
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                className={`w-full bg-gray-800 rounded-md pl-9 pr-3 py-1.5 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary ${
                  isCollapsed ? 'text-xs' : 'text-sm'
                }`}
                onClick={(e) => e.stopPropagation()}
              />
              {globalSearchQuery && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setGlobalSearchQuery('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-white"
                  title="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          
          {/* Collection selector */}
          <div className="py-0.5">
            <button
              className={`flex items-center justify-between w-full px-3 py-2 text-sm md:text-sm text-gray-300 hover:bg-gray-800 transition-colors ${isCollapsed ? 'text-xs py-1.5' : ''}`}
              onClick={() => setActiveSubMenu(activeSubMenu === 'collections' ? null : 'collections')}
            >
              <span className="font-medium">Collection</span>
              <span className="flex items-center gap-2">
                {selectedCollectionName && (
                  <span className={`text-primary text-sm font-medium truncate max-w-[140px] ${isCollapsed ? 'text-xs max-w-[120px]' : ''}`}>
                    {selectedCollectionName}
                  </span>
                )}
                <ChevronDown 
                  className={`h-4 w-4 text-gray-400 transition-transform ${activeSubMenu === 'collections' ? 'rotate-180' : ''} ${isCollapsed ? 'h-3.5 w-3.5' : ''}`}
                />
              </span>
            </button>
            
            {activeSubMenu === 'collections' && (
              <div className="max-h-[300px] sm:max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
                {collectionsLoading ? (
                  <div className="px-3 py-2 animate-pulse bg-gray-800/50 mx-3 rounded"></div>
                ) : (
                  renderOptions(collections, 'collection')
                )}
              </div>
            )}
          </div>
          
          {/* Category selector - only shown when a collection is selected */}
          {selectedCollection && (
            <div className="py-0.5">
              <button
                className={`flex items-center justify-between w-full px-3 py-2 text-sm md:text-sm text-gray-300 hover:bg-gray-800 transition-colors ${isCollapsed ? 'text-xs py-1.5' : ''}`}
                onClick={() => setActiveSubMenu(activeSubMenu === 'categories' ? null : 'categories')}
              >
                <span className="font-medium">Category</span>
                <span className="flex items-center gap-2">
                  {selectedCategoryName && (
                    <span className={`text-primary text-sm font-medium truncate max-w-[140px] ${isCollapsed ? 'text-xs max-w-[120px]' : ''}`}>
                      {selectedCategoryName}
                    </span>
                  )}
                  <ChevronDown 
                    className={`h-4 w-4 text-gray-400 transition-transform ${activeSubMenu === 'categories' ? 'rotate-180' : ''} ${isCollapsed ? 'h-3.5 w-3.5' : ''}`}
                  />
                </span>
              </button>
              
              {activeSubMenu === 'categories' && (
                <div className="max-h-[300px] sm:max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
                  {categoriesLoading ? (
                    <div className="px-3 py-2 animate-pulse bg-gray-800/50 mx-3 rounded"></div>
                  ) : (
                    <button
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-800 transition-colors ${
                        !selectedCategory ? 'bg-gray-800/50 font-medium text-primary' : 'text-gray-300'
                      } ${isCollapsed ? 'text-xs px-3 py-1.5' : ''}`}
                      onClick={() => handleOptionSelect('category', '')}
                    >
                      All Categories
                    </button>
                  )}
                  {!categoriesLoading && renderOptions(categories, 'category')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 