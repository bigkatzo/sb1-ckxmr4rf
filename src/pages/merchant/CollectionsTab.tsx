import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { useMerchantDashboard } from '../../contexts/MerchantDashboardContext';
import { useFilterPersistence } from '../../hooks/useFilterPersistence';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { CollectionForm } from '../../components/merchant/forms/CollectionForm';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { toast } from 'react-toastify';
import { createCollection, updateCollection, deleteCollection, toggleVisibility } from '../../services/collections';
import { InlineFilterBar } from '../../components/merchant/InlineFilterBar';

// Define the filter state type
interface CollectionFilterState {
  searchQuery: string;
}

// Initial filter state
const initialFilterState: CollectionFilterState = {
  searchQuery: ''
};

export function CollectionsTab() {
  const { setSelectedCollection, selectedCollection } = useMerchantDashboard();
  
  const [showForm, setShowForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Use the filter persistence hook
  const [filters, setFilters] = useFilterPersistence<CollectionFilterState>(
    'merchant_collections',
    'all', // Collections don't have a parent scope, so we use a fixed key
    initialFilterState
  );
  
  const { collections, loading, error, refetch } = useMerchantCollections();

  // Helper functions for updating individual filter properties
  const updateSearchQuery = (query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  };
  
  // Filter collections based on current filter settings
  const filteredCollections = collections.filter(collection => {
    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      if (!collection.name.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    return true;
  });

  const handleSubmit = async (data: FormData) => {
    try {
      if (editingCollection) {
        await updateCollection(editingCollection.id, data);
        toast.success('Collection updated successfully');
      } else {
        await createCollection(data);
        toast.success('Collection created successfully');
      }
      setShowForm(false);
      setEditingCollection(null);
      refetch();
    } catch (error) {
      console.error('Error with collection:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save collection';
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCollection(id);
      refetch();
      toast.success('Collection deleted successfully');
    } catch (error) {
      console.error('Error deleting collection:', error);
      if (error instanceof Error) {
        if (error.message.includes('Cannot delete collection with existing products')) {
          toast.error('This collection has products. Please delete these products first.');
        } else {
          toast.error(`Failed to delete collection: ${error.message}`);
        }
      } else {
        toast.error('Failed to delete collection');
      }
    } finally {
      setShowConfirmDialog(false);
      setDeletingId(null);
    }
  };

  const handleToggleVisibility = async (id: string, visible: boolean) => {
    try {
      setActionLoading(id);
      await toggleVisibility(id, visible);
      toast.success(`Collection ${visible ? 'shown' : 'hidden'} successfully`);
      refetch();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to toggle visibility');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectCollection = (collectionId: string) => {
    setSelectedCollection(collectionId);
    // Optionally show a toast confirmation
    const collection = collections.find(c => c.id === collectionId);
    if (collection) {
      toast.info(`Selected collection "${collection.name}"`, {
        autoClose: 2000
      });
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 animate-pulse space-y-4">
        <div className="h-10 bg-gray-800 rounded w-1/4" />
        <div className="h-40 bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-5">
        {/* Filters and Actions Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Left side - InlineFilterBar - 1 column on desktop, hidden on mobile for collections since it's not needed */}
          <div className="hidden sm:block sm:col-span-1">
            <InlineFilterBar />
          </div>
          
          {/* Middle - Search Input - full width on mobile, but 2 columns on desktop */}
          <div className="sm:col-span-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search collections by name..."
                value={filters.searchQuery}
                onChange={(e) => updateSearchQuery(e.target.value)}
                className="w-full bg-gray-800 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm border border-gray-700 hover:border-gray-600 transition-colors"
              />
            </div>
          </div>

          {/* Right side - Refresh & Add Buttons - full width on mobile, wrapped in flex for alignment */}
          <div className="flex items-center gap-2 justify-between sm:justify-end sm:col-span-1">
            <RefreshButton onRefresh={refetch} className="flex-shrink-0" />
            
            <button
              onClick={() => {
                setEditingCollection(null);
                setShowForm(true);
              }}
              className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Collection</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="bg-red-500/10 text-red-500 rounded-lg p-4">
          <p className="text-sm">{error}</p>
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4">
          {collections.length === 0 ? (
          <p className="text-gray-400 text-sm">No collections created yet.</p>
          ) : (
            <p className="text-gray-400 text-sm">No collections match the current filters.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCollections.map((collection) => (
            <div 
              key={collection.id}
              className={`group cursor-pointer rounded-lg overflow-hidden transition-colors ${
                selectedCollection === collection.id 
                  ? 'bg-primary/10 border-2 border-primary' 
                  : 'bg-gray-800 hover:bg-gray-700 border-2 border-transparent'
              }`}
              onClick={() => handleSelectCollection(collection.id)}
            >
              <div className="relative">
                {collection.imageUrl && (
                  <img 
                    src={collection.imageUrl} 
                    alt={collection.name} 
                    className="w-full h-32 object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent opacity-70" />
                
                <div className="absolute bottom-2 right-4 flex gap-2">
                  {!collection.isOwner && collection.accessType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400">
                      {collection.accessType === 'edit' ? 'Edit Access' : 'View Access'}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${collection.visible ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {collection.visible ? 'Visible' : 'Hidden'}
                  </span>
                </div>
              </div>
              
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-lg">{collection.name}</h3>
                  {selectedCollection === collection.id && (
                    <div className="flex items-center justify-center h-5 w-5 rounded-full bg-primary">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-gray-400 text-sm mt-1 line-clamp-2">{collection.description || 'No description'}</p>
                
                <div className="mt-4 flex justify-between items-center">
                  <div className="flex gap-2 text-xs text-gray-400">
                    <span>{collection.productCount || 0} products</span>
                    <span>•</span>
                    <span>{collection.categoryCount || 0} categories</span>
                  </div>
                  
                  <div className="flex gap-2">
                    {collection.isOwner && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                  setEditingCollection(collection);
                  setShowForm(true);
                          }}
                          className="bg-gray-700 text-gray-300 hover:bg-gray-600 px-2 py-1 rounded text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                  setDeletingId(collection.id);
                  setShowConfirmDialog(true);
                          }}
                          className="bg-red-900/30 text-red-400 hover:bg-red-900/50 px-2 py-1 rounded text-xs"
                          disabled={actionLoading === collection.id}
                        >
                          Delete
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleVisibility(collection.id, !collection.visible);
                          }}
                          className="bg-gray-700 text-gray-300 hover:bg-gray-600 px-2 py-1 rounded text-xs"
                          disabled={actionLoading === collection.id}
                        >
                          {collection.visible ? 'Hide' : 'Show'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-400 invisible group-hover:visible">
                Click to select this collection for dashboard views
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CollectionForm
          collection={editingCollection}
          onClose={() => {
            setShowForm(false);
            setEditingCollection(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

        <ConfirmDialog
          open={showConfirmDialog}
          onClose={() => {
            setShowConfirmDialog(false);
            setDeletingId(null);
          }}
          title="Delete Collection"
        description="Are you sure you want to delete this collection? This action cannot be undone. All products in this collection must be deleted first."
          confirmLabel="Delete"
        onConfirm={() => deletingId && handleDelete(deletingId)}
        />
    </div>
  );
}