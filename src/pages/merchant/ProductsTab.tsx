import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { ProductForm } from '../../components/merchant/forms/ProductForm/index';
import { ProductListItem } from '../../components/merchant/ProductListItem';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { useCategories } from '../../hooks/useCategories';
import { useProducts } from '../../hooks/useProducts';
import { useOptimisticUpdate } from '../../hooks/useOptimisticUpdate';
import { createProduct, updateProduct, deleteProduct } from '../../services/products';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { toast } from 'react-toastify';
import { createCategoryIndices } from '../../utils/category-mapping';
import type { Product } from '../../types/variants';

export function ProductsTab() {
  const [showForm, setShowForm] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { collections, loading: collectionsLoading } = useMerchantCollections();
  const { categories } = useCategories(selectedCollection);
  const { 
    products: initialProducts, 
    loading: productsLoading, 
    error: productsError,
    refreshProducts
  } = useProducts(selectedCollection, undefined, true);

  const {
    items: products,
    addItem,
    updateItem,
    removeItem,
    revertUpdate
  } = useOptimisticUpdate<Product>(initialProducts);

  // Update products when initialProducts changes
  useEffect(() => {
    revertUpdate(initialProducts);
  }, [initialProducts, revertUpdate]);

  // Create category indices mapping
  const categoryIndices = createCategoryIndices(categories);

  const handleSubmit = async (data: FormData) => {
    try {
      if (editingProduct) {
        // Optimistically update the product
        const optimisticProduct = {
          ...editingProduct,
          name: data.get('name') as string,
          description: data.get('description') as string,
          // Add other fields as needed
        };
        updateItem(editingProduct.id, optimisticProduct);

        const updatedProduct = await updateProduct(editingProduct.id, data);
        if (updatedProduct) {
          updateItem(editingProduct.id, updatedProduct);
          toast.success('Product updated successfully');
        }
      } else {
        // Create a temporary ID for optimistic update
        const tempId = `temp-${Date.now()}`;
        const optimisticProduct = {
          id: tempId,
          name: data.get('name') as string,
          description: data.get('description') as string,
          // Add other required fields
        } as Product;
        addItem(optimisticProduct);

        const newProduct = await createProduct(selectedCollection, data);
        if (newProduct) {
          // Remove temp product and add the real one
          removeItem(tempId);
          addItem(newProduct);
          toast.success('Product created successfully');
        }
      }
      setShowForm(false);
      setEditingProduct(undefined);
    } catch (error) {
      console.error('Error with product:', error);
      toast.error('Failed to save product');
      // Revert to initial state on error
      revertUpdate(initialProducts);
    }
  };

  const handleDelete = async (id: string) => {
    const originalProducts = [...products];
    try {
      // Optimistically remove the product
      removeItem(id);
      
      const success = await deleteProduct(id);
      if (success) {
        setShowConfirmDialog(false);
        setDeletingId(null);
        toast.success('Product deleted successfully');
      } else {
        // Revert if delete failed
        revertUpdate(originalProducts);
        toast.error('Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
      // Revert on error
      revertUpdate(originalProducts);
    }
  };

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
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Products</h2>
            <RefreshButton onRefresh={refreshProducts} />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="w-full sm:w-auto bg-gray-800 rounded-lg px-3 py-1.5 text-sm"
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
          {selectedCollection && collections.find(c => 
            c.id === selectedCollection && 
            (c.isOwner || c.accessType === 'edit')
          ) && (
            <button
              onClick={() => {
                setEditingProduct(undefined);
                setShowForm(true);
              }}
              className="flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      </div>

      {!selectedCollection ? (
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Please select a collection to manage products.</p>
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
      ) : products.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-gray-400 text-sm">No products created for this collection yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const collection = collections.find(c => c.id === selectedCollection);
            const canEdit = collection && (collection.isOwner || collection.accessType === 'edit');
            
            return (
              <ProductListItem
                key={product.id}
                product={product}
                categoryIndex={product.categoryId ? categoryIndices[product.categoryId] : 0}
                onEdit={canEdit ? () => {
                  setEditingProduct(product);
                  setShowForm(true);
                } : undefined}
                onDelete={canEdit ? () => {
                  setDeletingId(product.id);
                  setShowConfirmDialog(true);
                } : undefined}
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
            setEditingProduct(undefined);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {showConfirmDialog && deletingId && (
        <ConfirmDialog
          open={showConfirmDialog}
          onClose={() => {
            setShowConfirmDialog(false);
            setDeletingId(null);
          }}
          title="Delete Product"
          description="Are you sure you want to delete this product? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deletingId)}
        />
      )}
    </div>
  );
}