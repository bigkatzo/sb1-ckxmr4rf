import React, { createContext, useContext } from 'react';
import { cacheManager } from '../lib/cache';

interface CollectionContextType {
  invalidateCollection: (slug: string) => void;
}

const CollectionContext = createContext<CollectionContextType>({
  invalidateCollection: () => {},
});

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  // Function to invalidate a collection in the cache
  const invalidateCollection = (slug: string) => {
    cacheManager.invalidateKey(`collection:${slug}`);
  };

  return (
    <CollectionContext.Provider value={{ invalidateCollection }}>
      {children}
    </CollectionContext.Provider>
  );
}

export const useCollectionContext = () => useContext(CollectionContext);