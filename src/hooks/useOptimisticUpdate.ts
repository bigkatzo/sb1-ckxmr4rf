import { useState, useCallback } from 'react';

type UpdateFn<T> = (prev: T[]) => T[];
type ItemUpdate<T> = T | T[] | UpdateFn<T>;

export function useOptimisticUpdate<T extends { id: string }>(initialItems: T[] = []) {
  const [items, setItems] = useState<T[]>(initialItems);

  const updateItems = useCallback((update: ItemUpdate<T>) => {
    setItems(prev => {
      if (typeof update === 'function') {
        return update(prev);
      }
      
      if (Array.isArray(update)) {
        return update;
      }

      return prev.map(item => 
        item.id === update.id ? update : item
      );
    });
  }, []);

  const addItem = useCallback((item: T) => {
    setItems(prev => [...prev, item]);
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<T>) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const revertUpdate = useCallback((originalItems: T[]) => {
    setItems(originalItems);
  }, []);

  return {
    items,
    setItems,
    updateItems,
    addItem,
    updateItem,
    removeItem,
    revertUpdate
  };
} 