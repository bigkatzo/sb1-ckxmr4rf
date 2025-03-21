import { useOptimisticUpdate } from './useOptimisticUpdate';
import type { Category } from '../types/categories';

export function useCategoryOptimisticUpdate(initialCategories: Category[] = []) {
  const {
    items: categories,
    addItem,
    updateItem,
    removeItem,
    revertUpdate,
    setItems
  } = useOptimisticUpdate<Category>(initialCategories);

  const toggleVisibility = (id: string, visible: boolean) => {
    updateItem(id, { visible });
  };

  const updateOrder = (id: string, order: number) => {
    updateItem(id, { order });
  };

  const updateBulkOrder = (updates: { id: string; order: number }[]) => {
    updates.forEach(({ id, order }) => {
      updateItem(id, { order });
    });
  };

  return {
    categories,
    setCategories: setItems,
    addCategory: addItem,
    updateCategory: updateItem,
    removeCategory: removeItem,
    revertCategories: revertUpdate,
    toggleVisibility,
    updateOrder,
    updateBulkOrder
  };
} 