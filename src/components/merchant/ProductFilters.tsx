import { Search } from 'lucide-react';

interface ProductFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ProductFilters({
  searchQuery,
  onSearchChange
}: ProductFiltersProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search products by name, SKU, description..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-gray-800 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm border border-gray-700 hover:border-gray-600 transition-colors"
        />
      </div>
    </div>
  );
} 