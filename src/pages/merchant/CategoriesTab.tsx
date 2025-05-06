import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CategoryForm } from '../../components/merchant/forms/CategoryForm';
import { CategoryListItem } from '../../components/merchant/CategoryListItem';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { useCategories } from '../../hooks/useCategories';
import { createCategory, updateCategory, deleteCategory, toggleVisibility, toggleSaleEnded } from '../../services/categories';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { toast } from 'react-toastify';
import { useMerchantDashboard } from '../../contexts/MerchantDashboardContext';
import { useFilterPersistence } from '../../hooks/useFilterPersistence';
import { InlineFilterBar } from '../../components/merchant/InlineFilterBar';
import { CollapsibleSearchBar } from '../../components/merchant/CollapsibleSearchBar';

// Define the filter state type
interface CategoryFilterState {
  searchQuery: string;
}

// Initial filter state
const initialFilterState: CategoryFilterState = {
  searchQuery: ''
};

export function CategoriesTab() {
  const { selectedCollection, setSelectedCategory, selectedCategory } = useMerchantDashboard();
  
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { collections, loading: collectionsLoading, refetch } = useMerchantCollections();
  const { categories, loading: categoriesLoading, refreshCategories } = useCategories(selectedCollection);
  
  // Use the filter persistence hook
  const [filters, setFilters] = useFilterPersistence<CategoryFilterState>(
    'merchant_categories',
    selectedCollection,
    initialFilterState
  );
  
  // Helper functions for updating individual filter properties
  const updateSearchQuery = (query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  };
  
  // Filter categories based on current filter settings
  const filteredCategories = categories.filter(category => {
    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      if (!category.name?.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    return true;
  });

  const handleRefreshAll = async () => {
    const refreshPromises = [refetch()];
    if (selectedCollection) {
      refreshPromises.push(refreshCategories());
    }
    await Promise.all(refreshPromises);
  };

  const handleSubmit = async (data: FormData) => {
    try {
      if (!selectedCollection) {
        toast.error('Please select a collection first');
        return;
      }

      if (editingCategory) {
        await updateCategory(editingCategory.id, data);
        toast.success('Category updated successfully');
      } else {
        await createCategory(data, selectedCollection);
        toast.success('Category created successfully');
      }
      setShowForm(false);
      setEditingCategory(null);
      refreshCategories();
    } catch (error) {
      console.error('Error with category:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save category';
      toast.error(errorMessage);
    }
  };

  // Select a category for filtering in the products tab
  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    // Optional: Show a confirmation toast
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      toast.info(`Selected category "${category.name}" for filtering products`, {
        autoClose: 2000
      });
    }
  };

  const handleToggleVisibility = async (id: string, visible: boolean) => {
    try {
      setActionLoading(id);
      await toggleVisibility(id, visible);
      toast.success(`Category ${visible ? 'shown' : 'hidden'} successfully`);
      refreshCategories();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to toggle visibility');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSaleEnded = async (id: string, saleEnded: boolean) => {
    try {
      setActionLoading(id);
      await toggleSaleEnded(id, saleEnded);
      toast.success(`Sale ${saleEnded ? 'ended' : 'resumed'} successfully`);
      refreshCategories();
    } catch (error) {
      console.error('Error toggling sale status:', error);
      toast.error('Failed to toggle sale status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      refreshCategories();
      toast.success('Category deleted successfully');
    } catch (error) {
      console.error('Error deleting category:', error);
      if (error instanceof Error) {
        if (error.message.includes('Cannot delete category with existing products')) {
          toast.error('This category has products. Please reassign or delete these products first.');
        } else {
          toast.error(`Failed to delete category: ${error.message}`);
        }
      } else {
        toast.error('Failed to delete category');
      }
    } finally {
      setShowConfirmDialog(false);
      setDeletingId(null);
    }
  };

  if (collectionsLoading) {
    return (
      <div className="px-3 sm:px-6 lg:px-8 animate-pulse space-y-4">
        <div className="h-10 bg-gray-800 rounded w-1/4" />
        <div className="h-40 bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-6 lg:px-8">
      <div className="mb-5">
        {/* Single row with all controls */}
        <div className="flex items-center gap-2">
          {/* Global Filter - Original width on desktop */}
          <div className="w-auto md:w-auto lg:w-auto min-w-0">
            <InlineFilterBar />
          </div>
          
          {/* Search - Take more space on desktop */}
          <div className="flex-1 min-w-0 mr-auto">
            <CollapsibleSearchBar
              searchQuery={filters.searchQuery}
              onSearchChange={updateSearchQuery}
              placeholder="Search categories by name..."
            />
          </div>
          
          {/* Actions - Always pinned to the right */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <RefreshButton onRefresh={handleRefreshAll} />
            
            {selectedCollection && collections.find(c => 
              c.id === selectedCollection && 
              (c.isOwner || c.accessType === 'edit')
            ) && (
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setShowForm(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white p-2 md:px-4 md:py-2 rounded-lg transition-colors text-sm font-medium shadow-sm whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">Add Category</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {!selectedCollection ? (
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Please select a collection using the filter above to manage categories.</p>
        </div>
      ) : categoriesLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-800 rounded" />
          <div className="h-20 bg-gray-800 rounded" />
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4">
          {categories.length === 0 ? (
          <p className="text-gray-400 text-sm">No categories created for this collection yet.</p>
          ) : (
            <p className="text-gray-400 text-sm">No categories match the current filters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map((category, index) => {
            const collection = collections.find(c => c.id === selectedCollection);
            const canEdit = collection && (collection.isOwner || collection.accessType === 'edit');
            const isActionDisabled = actionLoading === category.id;
            
            return (
              <div 
                key={category.id} 
                className="group cursor-pointer"
                onClick={() => handleSelectCategory(category.id)}
              >
              <CategoryListItem
                category={category}
                index={index}
                selected={selectedCategory === category.id}
                onEdit={canEdit ? () => {
                  setEditingCategory(category);
                  setShowForm(true);
                } : undefined}
                onDelete={canEdit && !isActionDisabled ? () => {
                  setDeletingId(category.id);
                  setShowConfirmDialog(true);
                } : undefined}
                onToggleVisibility={canEdit && !isActionDisabled ? 
                    (visible) => {
                      // Stop event propagation to prevent selection
                      handleToggleVisibility(category.id, visible);
                    } : undefined}
                onToggleSaleEnded={canEdit && !isActionDisabled ? 
                    (saleEnded) => {
                      // Stop event propagation to prevent selection
                      handleToggleSaleEnded(category.id, saleEnded);
                    } : undefined}
              />
              </div>
            );
          })}
        </div>
      )}

      {showForm && selectedCollection && (
        <CategoryForm
          onClose={() => {
            setShowForm(false);
            setEditingCategory(null);
          }}
          onSubmit={handleSubmit}
          initialData={editingCategory}
        />
      )}

        <ConfirmDialog
          open={showConfirmDialog}
          onClose={() => {
            setShowConfirmDialog(false);
            setDeletingId(null);
          }}
          title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone. Any products in this category will need to be reassigned."
          confirmLabel="Delete"
        onConfirm={() => deletingId && handleDelete(deletingId)}
        />
    </div>
  );
}