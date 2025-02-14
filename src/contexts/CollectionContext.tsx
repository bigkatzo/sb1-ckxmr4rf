import React, { createContext, useContext, useState } from 'react';
import type { Collection } from '../types';

interface CollectionContextType {
  cachedCollection: Collection | null;
  setCachedCollection: (collection: Collection | null) => void;
}

const CollectionContext = createContext<CollectionContextType>({
  cachedCollection: null,
  setCachedCollection: () => {},
});

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const [cachedCollection, setCachedCollection] = useState<Collection | null>(null);

  return (
    <CollectionContext.Provider value={{ cachedCollection, setCachedCollection }}>
      {children}
    </CollectionContext.Provider>
  );
}

export const useCollectionCache = () => useContext(CollectionContext);