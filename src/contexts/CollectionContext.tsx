import React, { createContext, useContext } from 'react';
import { cacheManager } from '../lib/cache';
import type { Collection } from '../types/collections';

interface CollectionContextType {
  invalidateCollection: (slug: string) => void;
}

const CollectionContext = createContext<CollectionContextType>({
  invalidateCollection: () => {},
});

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  // Function to invalidate a collection in the cache
  const invalidateCollection = (slug: string) => {
    cacheManager.invalidate(`collection:${slug}`);
  };

  return (
    <CollectionContext.Provider value={{ invalidateCollection }}>
      {children}
    </CollectionContext.Provider>
  );
}

export const useCollectionCache = () => useContext(CollectionContext);