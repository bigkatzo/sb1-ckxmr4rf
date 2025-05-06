import { CollapsibleSearchBar } from './CollapsibleSearchBar';

interface ProductFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function ProductFilters({
  searchQuery,
  onSearchChange
}: ProductFiltersProps) {
  return (
    <div className="flex-1 md:max-w-xl">
      <CollapsibleSearchBar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        placeholder="Search products by name, SKU, description..."
      />
    </div>
  );
} 