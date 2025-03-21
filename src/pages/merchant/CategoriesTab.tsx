import { useState, useEffect } from 'react';
import { Plus, EyeOff } from 'lucide-react';
import { CategoryForm } from '../../components/merchant/forms/CategoryForm';
import type { CategoryFormData } from '../../components/merchant/forms/CategoryForm/types';
import { useMerchantCollections } from '../../hooks/useMerchantCollections';
import { useCategories } from '../../hooks/useCategories';
import { useCategoryOptimisticUpdate } from '../../hooks/useCategoryOptimisticUpdate';
import { createCategory, updateCategory, deleteCategory } from '../../services/categories';
import { EditButton } from '../../components/ui/EditButton';
import { DeleteButton } from '../../components/ui/DeleteButton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { RefreshButton } from '../../components/ui/RefreshButton';
import { toast } from 'react-toastify';
import { CategoryDiamond } from '../../components/collections/CategoryDiamond';
import { getCategoryTypeInfo } from '../../components/collections/CategoryTypeInfo';
import type { Category } from '../../types/categories';

// Add a function to transform the category data
const transformCategory = (category: Category | undefined) => {
  if (!category) return undefined;
  
  return {
    ...category,
    eligibilityRules: {
      groups: category.eligibilityRules.groups.map(group => ({
        ...group,
        operator: group.operator.toUpperCase() as "AND" | "OR" // Transform operator to uppercase
      }))
    }
  };
};

export function CategoriesTab() {
  const [showForm, setShowForm] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { collections, loading: collectionsLoading } = useMerchantCollections();
  const { categories: initialCategories, loading: categoriesLoading } = useCategories(selectedCollection);
  const {
    categories,
    addCategory,
    updateCategory: updateCategoryInState,
    removeCategory,
    revertCategories,
    toggleVisibility
  } = useCategoryOptimisticUpdate(initialCategories);

  // Update categories when initialCategories changes
  useEffect(() => {
    revertCategories(initialCategories);
  }, [initialCategories, revertCategories]);

  const handleSubmit = (data: FormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    (async () => {
      try {
        if (editingCategory) {
          // Optimistically update the category
          const formData: CategoryFormData = {
            name: data.get('name') as string,
            description: data.get('description') as string,
            type: data.get('type') as string,
            visible: data.get('visible') === 'true',
            order: parseInt(data.get('order') as string, 10)
          };

          const optimisticCategory = {
            ...editingCategory,
            ...formData
          };
          updateCategoryInState(editingCategory.id, optimisticCategory);

          const updatedCategory = await updateCategory(editingCategory.id, data);
          if (updatedCategory) {
            updateCategoryInState(editingCategory.id, updatedCategory);
            toast.success('Category updated successfully');
          }
        } else {
          if (!selectedCollection) {
            toast.error('Please select a collection first');
            return;
          }

          const formData: CategoryFormData = {
            name: data.get('name') as string,
            description: data.get('description') as string,
            type: data.get('type') as string,
            visible: true,
            order: categories.length
          };

          // Create a temporary ID for optimistic update
          const tempId = `temp-${Date.now()}`;
          const optimisticCategory = {
            id: tempId,
            ...formData,
            collection_id: selectedCollection,
            eligibilityRules: {
              groups: []
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } as Category;
          addCategory(optimisticCategory);

          const newCategory = await createCategory(selectedCollection, data);
          if (newCategory) {
            // Remove temp category and add the real one
            removeCategory(tempId);
            addCategory(newCategory);
            toast.success('Category created successfully');
          }
        }
        setShowForm(false);
        setEditingCategory(undefined);
      } catch (error) {
        console.error('Error with category:', error);
        toast.error('Failed to save category');
        // Revert to initial state on error
        revertCategories(initialCategories);
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const handleDelete = async (id: string) => {
    const originalCategories = [...categories];
    try {
      // Optimistically remove the category
      removeCategory(id);

      await deleteCategory(id);
      setShowConfirmDialog(false);
      setDeletingId(null);
      toast.success('Category deleted successfully');
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
      // Revert on error
      revertCategories(originalCategories);
    }
  };

  const handleToggleVisibility = async (id: string, visible: boolean) => {
    // Optimistically update visibility
    toggleVisibility(id, !visible);

    try {
      const formData = new window.FormData();
      formData.append('visible', (!visible).toString());
      await updateCategory(id, formData);
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to update visibility');
      // Revert on error
      toggleVisibility(id, visible);
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
            <RefreshButton onRefresh={() => revertCategories(initialCategories)} className="scale-90" />
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
                setEditingCategory(undefined);
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
          {categories.map((category) => {
            const collection = collections.find(c => c.id === selectedCollection);
            const canEdit = collection && (collection.isOwner || collection.accessType === 'edit');
            const typeInfo = getCategoryTypeInfo(category.type);
            
            return (
              <div
                key={category.id}
                className="flex items-center gap-3 bg-gray-900 rounded-lg p-3"
              >
                <CategoryDiamond type={category.type} selected={true} index={0} className="flex-shrink-0" />
                
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-white truncate">
                      {category.name}
                    </h3>
                    {!category.visible && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-medium">
                        <EyeOff className="h-2.5 w-2.5" />
                        Hidden
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-1">
                    {category.description || typeInfo.label}
                  </p>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleVisibility(category.id, category.visible)}
                      className="p-1 text-gray-400 hover:text-white transition-colors"
                    >
                      <EyeOff className="h-4 w-4" />
                    </button>
                    <EditButton 
                      onClick={() => {
                        setEditingCategory(category);
                        setShowForm(true);
                      }}
                      className="scale-90"
                    />
                    <DeleteButton 
                      onClick={() => {
                        setDeletingId(category.id);
                        setShowConfirmDialog(true);
                      }}
                      className="scale-90"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && selectedCollection && (
        <CategoryForm
          initialData={transformCategory(editingCategory)}
          onClose={() => {
            setShowForm(false);
            setEditingCategory(undefined);
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
          description="Are you sure you want to delete this category? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deletingId)}
        />
      )}
    </div>
  );
}