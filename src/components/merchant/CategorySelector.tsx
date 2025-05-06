import { X } from 'lucide-react';
import { useMerchantDashboard } from '../../contexts/MerchantDashboardContext';
import { useCategories } from '../../hooks/useCategories';

interface CategorySelectorProps {
  showLabel?: boolean;
  className?: string;
}

export function CategorySelector({ showLabel = false, className = '' }: CategorySelectorProps) {
  const { selectedCollection, selectedCategory, setSelectedCategory, clearCategorySelection } = useMerchantDashboard();
  const { categories, loading } = useCategories(selectedCollection);

  if (loading || !selectedCollection) {
    return <div className={`animate-pulse h-9 bg-gray-800 rounded w-48 ${className}`} />;
  }

  // If no categories available
  if (categories.length === 0) {
    return (
      <div className={`flex items-center ${className}`}>
        <span className="text-sm text-gray-400">No categories available</span>
      </div>
    );
  }

  // Find the current category for display purposes
  const currentCategory = categories.find(c => c.id === selectedCategory);
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <label className="text-sm text-gray-300">Category:</label>
      )}
      <div className="relative">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full sm:w-auto bg-gray-800 rounded-lg px-3 py-1.5 text-sm pr-8"
          disabled={!selectedCollection}
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {selectedCategory && (
          <button
            onClick={clearCategorySelection}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            title="Clear selection"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-white" />
          </button>
        )}
      </div>
      {selectedCategory && currentCategory && (
        <div className="bg-gray-700 text-gray-200 text-xs px-2 py-1 rounded-full">
          {currentCategory.name}
        </div>
      )}
    </div>
  );
} 