import { X, ChevronDown } from 'lucide-react';
import { CollectionSelector } from './CollectionSelector';
import { CategorySelector } from './CategorySelector';
import { useMerchantDashboard } from '../../contexts/MerchantDashboardContext';
import { useState } from 'react';

interface ContextSelectorBarProps {
  showCategorySelector?: boolean;
}

export function ContextSelectorBar({ showCategorySelector = true }: ContextSelectorBarProps) {
  const { selectedCollection, selectedCategory, clearAllSelections } = useMerchantDashboard();
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-gray-900 rounded-lg mb-4 overflow-hidden transition-all">
      {/* Header with expand/collapse toggle for mobile */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer sm:cursor-default"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="text-sm font-medium flex items-center gap-2">
          <span>Global Filters</span>
          {(selectedCollection || selectedCategory) && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
              {selectedCollection && selectedCategory 
                ? '2 active' 
                : '1 active'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(selectedCollection || selectedCategory) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearAllSelections();
              }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
              title="Clear all selections"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear all filters</span>
            </button>
          )}
          <ChevronDown 
            className={`h-4 w-4 sm:hidden transition-transform ${expanded ? 'rotate-180' : ''}`} 
          />
        </div>
      </div>
      
      {/* Collapsible content */}
      <div className={`${expanded ? 'max-h-60' : 'max-h-0 sm:max-h-60'} overflow-hidden transition-all duration-300 ease-in-out`}>
        <div className="flex flex-col sm:flex-row gap-3 p-3 pt-0 sm:pt-3 border-t border-gray-800">
          <CollectionSelector showLabel={true} />
          {showCategorySelector && selectedCollection && (
            <CategorySelector showLabel={true} />
          )}
        </div>
      </div>
    </div>
  );
} 