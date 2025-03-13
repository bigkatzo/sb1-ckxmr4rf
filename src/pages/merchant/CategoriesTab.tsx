import { useState } from 'react';
import { Plus, EyeOff, Ban } from 'lucide-react';
import { CategoryForm } from '../../components/merchant/forms/CategoryForm';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { useCategories } from '../../hooks/useCategories';
import { createCategory, updateCategory, deleteCategory } from '../../services/categories';
import { EditButton } from '../../components/ui/EditButton';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { toast } from 'react-toastify';
import { CategoryDiamond } from '../../components/collections/CategoryDiamond';
import { getCategoryTypeInfo } from '../../components/collections/CategoryTypeInfo';

export function CategoriesTab() {
  const [showForm, setShowForm] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { collections, loading: collectionsLoading, refreshCollections } = useMerchantCollections();
  const { categories, loading: categoriesLoading, refreshCategories } = useCategories(selectedCollection);

  const handleRefreshAll = async () => {
    await Promise.all([refreshCategories(), refreshCollections()]);
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
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold">Categories</h2>
            <RefreshButton onRefresh={handleRefreshAll} className="scale-90" />
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
                setEditingCategory(null);
                setShowForm(true);
              }}
              className="flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Add Category</span>
            </button>
          )}
        </div>
      </div>

      {!selectedCollection ? (
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-gray-400 text-sm">Please select a collection to manage categories.</p>
        </div>
      ) : categoriesLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-gray-800 rounded" />
          <div className="h-20 bg-gray-800 rounded" />
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4">
          <p className="text-gray-400 text-sm">No categories created for this collection yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((category, index) => {
            const collection = collections.find(c => c.id === selectedCollection);
            const canEdit = collection && (collection.isOwner || collection.accessType === 'edit');
            
            return (
              <div key={category.id} className="bg-gray-900 rounded-lg p-2.5 sm:p-3 group">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <CategoryDiamond 
                      type={category.type}
                      index={index}
                      selected
                      size="lg"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-xs sm:text-sm truncate">{category.name}</h3>
                          {category.visible === false && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-400">
                              <EyeOff className="h-3 w-3" />
                              Hidden
                            </span>
                          )}
                          {category.saleEnded && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400">
                              <Ban className="h-3 w-3" />
                              Sale Ended
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-[10px] sm:text-xs line-clamp-2 mt-1">
                          {category.description}
                        </p>
                        <div className="mt-2">
                          {(() => {
                            const typeInfo = getCategoryTypeInfo(category.type, category.eligibilityRules?.groups || []);
                            return (
                              <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${typeInfo.style}`}>
                                {typeInfo.icon}
                                <span className="font-medium">{typeInfo.label}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <EditButton onClick={() => {
                            setEditingCategory(category);
                            setShowForm(true);
                          }} className="scale-75 sm:scale-90" />
                          <DeleteButton onClick={() => {
                            setDeletingId(category.id);
                            setShowConfirmDialog(true);
                          }} className="scale-75 sm:scale-90" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && selectedCollection && (
        <CategoryForm
          initialData={editingCategory}
          onClose={() => {
            setShowForm(false);
            setEditingCategory(null);
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
          title="Delete Category"
          description="Are you sure you want to delete this category? All products in this category will also be deleted. This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={async () => {
            try {
              await deleteCategory(deletingId);
              refreshCategories();
              toast.success('Category deleted successfully');
            } catch (error) {
              console.error('Error deleting category:', error);
              toast.error('Failed to delete category');
            } finally {
              setShowConfirmDialog(false);
              setDeletingId(null);
            }
          }}
        />
      )}
    </div>
  );
}