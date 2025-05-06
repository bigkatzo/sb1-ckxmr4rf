import { X } from 'lucide-react';
import { CollectionSelector } from './CollectionSelector';
import { CategorySelector } from './CategorySelector';
import { useMerchantDashboard } from '../../contexts/MerchantDashboardContext';

interface ContextSelectorBarProps {
  showCategorySelector?: boolean;
}

export function ContextSelectorBar({ showCategorySelector = true }: ContextSelectorBarProps) {
  const { selectedCollection, selectedCategory, clearAllSelections } = useMerchantDashboard();
  
  return (
    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between p-3 bg-gray-900 rounded-lg mb-4">
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <CollectionSelector showLabel={true} />
        {showCategorySelector && selectedCollection && (
          <CategorySelector showLabel={true} />
        )}
      </div>
      
      {(selectedCollection || selectedCategory) && (
        <button
          onClick={clearAllSelections}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
          title="Clear all selections"
        >
          <X className="h-3.5 w-3.5" />
          <span>Clear all filters</span>
        </button>
      )}
    </div>
  );
} 