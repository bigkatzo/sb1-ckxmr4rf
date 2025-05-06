import { X } from 'lucide-react';
import { useMerchantDashboard } from '../../contexts/MerchantDashboardContext';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';

interface CollectionSelectorProps {
  showLabel?: boolean;
  className?: string;
}

export function CollectionSelector({ showLabel = false, className = '' }: CollectionSelectorProps) {
  const { collections, loading } = useMerchantCollections();
  const { selectedCollection, setSelectedCollection, clearCollectionSelection } = useMerchantDashboard();

  if (loading) {
    return (
      <div className={`animate-pulse h-9 bg-gray-800 rounded w-48 ${className}`} />
    );
  }

  // Find the current collection for display purposes
  const currentCollection = collections.find(c => c.id === selectedCollection);
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <label className="text-sm text-gray-300">Collection:</label>
      )}
      <div className="relative">
        <select
          value={selectedCollection}
          onChange={(e) => setSelectedCollection(e.target.value)}
          className="w-full sm:w-auto bg-gray-800 rounded-lg px-3 py-1.5 text-sm pr-8"
        >
          <option value="">Select Collection</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name} {!collection.accessType && '(Owner)'}
              {collection.accessType === 'edit' && '(Edit)'}
              {collection.accessType === 'view' && '(View)'}
            </option>
          ))}
        </select>
        {selectedCollection && (
          <button
            onClick={clearCollectionSelection}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            title="Clear selection"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-white" />
          </button>
        )}
      </div>
      {selectedCollection && currentCollection && (
        <div className="bg-primary/20 text-primary-foreground text-xs px-2 py-1 rounded-full">
          {currentCollection.name}
        </div>
      )}
    </div>
  );
} 