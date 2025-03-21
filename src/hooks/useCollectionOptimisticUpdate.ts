import { useOptimisticUpdate } from './useOptimisticUpdate';
import type { Collection, AccessType } from '../types/collections';

export function useCollectionOptimisticUpdate(initialCollections: Collection[]) {
  const {
    items: collections,
    addItem,
    updateItem,
    removeItem,
    revertUpdate,
    setItems
  } = useOptimisticUpdate<Collection>(initialCollections);

  const toggleFeaturedStatus = (id: string, featured: boolean) => {
    updateItem(id, { featured });
  };

  const toggleVisibility = (id: string, visible: boolean) => {
    updateItem(id, { visible });
  };

  const updateAccessType = (id: string, accessType: AccessType | null) => {
    updateItem(id, {
      accessType,
      // You might want to update other access-related fields here
    });
  };

  return {
    collections,
    setCollections: setItems,
    addCollection: addItem,
    updateCollection: updateItem,
    removeCollection: removeItem,
    revertCollections: revertUpdate,
    toggleFeaturedStatus,
    toggleVisibility,
    updateAccessType
  };
} 