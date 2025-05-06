import { useState } from 'react';
import { ProductForm } from '../../components/merchant/forms/ProductForm/ProductForm';
import { ProductListItem } from '../../components/merchant/ProductListItem';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { useCategories } from '../../hooks/useCategories';
import { useProducts } from '../../hooks/useProducts';
import { 
  createProduct, 
  updateProduct, 
  deleteProduct, 
  getProductForDuplication,
  toggleSaleEnded,
  toggleProductVisibility
} from '../../services/products';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { toast } from 'react-toastify';
import { createCategoryIndices } from '../../utils/category-mapping';
import { ProductFilters } from '../../components/merchant/ProductFilters';
import { useFilterPersistence } from '../../hooks/useFilterPersistence';
import { useMerchantDashboard } from '../../contexts/MerchantDashboardContext';
import { Plus } from 'lucide-react';
import { InlineFilterBar } from '../../components/merchant/InlineFilterBar';

// Define the filter state type
interface ProductFilterState {
  searchQuery: string;
}

// Initial filter state
const initialFilterState: ProductFilterState = {
  searchQuery: ''
};

export function ProductsTab() {
  const { selectedCollection, selectedCategory } = useMerchantDashboard();
  
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Use the filter persistence hook
  const [filters, setFilters] = useFilterPersistence<ProductFilterState>(
    'merchant_products',
    selectedCollection,
    initialFilterState
  );

  const { collections, loading: collectionsLoading } = useMerchantCollections();
  const { categories } = useCategories(selectedCollection);
  const { products, loading: productsLoading, error: productsError, refreshProducts } = useProducts(selectedCollection, undefined, true);

  // Create category indices mapping
  const categoryIndices = createCategoryIndices(categories);

  const handleSubmit = async (data: FormData) => {
    try {
      setFormLoading(true);
      if (editingProduct && editingProduct.id) {
        // Update existing product
        await updateProduct(editingProduct.id, data);
        toast.success('Product updated successfully');
      } else {
        // Create new product
        // Make sure the collection ID is correctly set
        data.append('collection', selectedCollection);
        
        // If we're duplicating a product (editingProduct exists but has no ID)
        // Make sure the existing images are properly included
        if (editingProduct && editingProduct.images && !data.has('currentImages')) {
          data.append('currentImages', JSON.stringify(editingProduct.images));
        }
        
        await createProduct(selectedCollection, data);
        toast.success('Product created successfully');
      }
      setShowForm(false);
      setEditingProduct(null);
      refreshProducts();
    } catch (error) {
      console.error('Error with product:', error);
      let errorMessage = 'Error saving product';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      } else if (typeof error === 'object' && error !== null) {
        console.error('Detailed error object:', error);
      }
      
      toast.error(errorMessage);
      throw error; // Re-throw to let the form handle the error state
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    
    try {
      await deleteProduct(deletingId);
      toast.success('Product deleted successfully');
      refreshProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error deleting product';
      toast.error(errorMessage);
    } finally {
      setShowConfirmDialog(false);
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (productId: string) => {
    try {
      setDuplicating(true);
      const { success, productData } = await getProductForDuplication(productId);
      if (success && productData) {
        // Make sure the duplicated product is assigned to the currently selected collection
        const duplicateData = {
          ...productData,
          collectionId: selectedCollection
        };
        
        setEditingProduct(duplicateData);
        setShowForm(true);
        toast.info('Product loaded for duplication. Edit as needed and save to create a copy.');
      }
    } catch (error) {
      console.error('Error preparing product duplication:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error preparing product duplication';
      toast.error(errorMessage);
    } finally {
      setDuplicating(false);
    }
  };

  const handleToggleVisibility = async (productId: string, visible: boolean) => {
    try {
      setActionLoading(productId);
      const { success } = await toggleProductVisibility(productId, visible);
      if (success) {
        toast.success(`Product ${visible ? 'shown' : 'hidden'} successfully`);
        refreshProducts();
      }
    } catch (error) {
      console.error('Error toggling product visibility:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error updating product';
      toast.error(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSaleEnded = async (productId: string, saleEnded: boolean) => {
    try {
      setActionLoading(productId);
      const { success } = await toggleSaleEnded(productId, saleEnded);
      if (success) {
        toast.success(`Sale ${saleEnded ? 'ended' : 'resumed'} successfully`);
        refreshProducts();
      }
    } catch (error) {
      console.error('Error toggling sale status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error updating product';
      toast.error(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  // Helper functions for updating search query
  const updateSearchQuery = (query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  };

  // Filter products based on current filter settings
  const filteredProducts = products.filter(product => {
    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const nameMatch = product.name?.toLowerCase().includes(query) || false;
      const skuMatch = product.sku?.toLowerCase().includes(query) || false;
      const descriptionMatch = product.description?.toLowerCase().includes(query) || false;
      
      if (!(nameMatch || skuMatch || descriptionMatch)) {
        return false;
      }
    }

    // Filter by category (from context)
    if (selectedCategory && product.categoryId !== selectedCategory) {
      return false;
    }

    return true;
  });

  if (collectionsLoading || productsLoading) {
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
        {/* Single row with all controls */}
        <div className="flex items-center gap-2">
          {/* Global Filter - Give more space on mobile */}
          <div className="flex-1 md:w-[200px] lg:w-[240px] min-w-0">
            <InlineFilterBar />
          </div>
          
          {/* Search - Take remaining width, but allow buttons to stay right-aligned */}
          <div className="flex-1 min-w-0 mr-auto">
            <ProductFilters
              searchQuery={filters.searchQuery}
              onSearchChange={updateSearchQuery}
            />
          </div>
          
          {/* Actions - Always pinned to the right */}
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <RefreshButton onRefresh={refreshProducts} />
            
            {selectedCollection && collections.find(c => 
              c.id === selectedCollection && 
              (c.isOwner || c.accessType === 'edit')
            ) && (
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setShowForm(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white p-2 md:px-4 md:py-2 rounded-lg transition-colors text-sm font-medium shadow-sm whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">Add Product</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {!selectedCollection ? (
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Please select a collection using the filter above to manage products.</p>
        </div>
      ) : productsLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-800 rounded" />
          <div className="h-20 bg-gray-800 rounded" />
        </div>
      ) : productsError ? (
        <div className="bg-red-500/10 text-red-500 rounded-lg p-4">
          <p className="text-sm">{productsError}</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4">
          {products.length === 0 ? (
          <p className="text-gray-400 text-sm">No products created for this collection yet.</p>
          ) : (
            <p className="text-gray-400 text-sm">No products match the current filters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((product) => {
            const collection = collections.find(c => c.id === selectedCollection);
            const canEdit = collection && (collection.isOwner || collection.accessType === 'edit');
            const isActionDisabled = actionLoading === product.id || duplicating;
            
            return (
              <ProductListItem
                key={product.id}
                product={{
                  ...product,
                  collectionSlug: collection?.slug
                }}
                categoryIndex={product.categoryId ? categoryIndices[product.categoryId] : 0}
                onEdit={canEdit ? () => {
                  setEditingProduct(product);
                  setShowForm(true);
                } : undefined}
                onDelete={canEdit && !isActionDisabled ? () => {
                  setDeletingId(product.id);
                  setShowConfirmDialog(true);
                } : undefined}
                onDuplicate={canEdit && !isActionDisabled ? () => handleDuplicate(product.id) : undefined}
                onToggleVisibility={canEdit && !isActionDisabled ? (visible) => handleToggleVisibility(product.id, visible) : undefined}
                onToggleSaleEnded={canEdit && !isActionDisabled ? (saleEnded) => handleToggleSaleEnded(product.id, saleEnded) : undefined}
              />
            );
          })}
        </div>
      )}

      {showForm && selectedCollection && (
        <ProductForm
          categories={categories}
          initialData={editingProduct}
          onClose={() => {
            setShowForm(false);
            setEditingProduct(null);
          }}
          onSubmit={handleSubmit}
          isLoading={formLoading}
        />
      )}

        <ConfirmDialog
          open={showConfirmDialog}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
          onClose={() => {
            setShowConfirmDialog(false);
            setDeletingId(null);
          }}
          onConfirm={handleDelete}
        />
    </div>
  );
}