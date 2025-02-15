import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CollectionCard } from './CollectionCard';
import { useCollections } from '../../hooks/useCollections';
import { createCategoryIndicesFromProducts } from '../../utils/category-mapping';

interface CollectionGridProps {
  filter: 'upcoming' | 'latest' | 'popular';
}

export function CollectionGrid({ filter }: CollectionGridProps) {
  const { collections, loading } = useCollections(filter);
  const navigate = useNavigate();
  const categoryIndices = React.useMemo(() => {
    const allProducts = collections.flatMap(c => c.products.map(p => ({
      ...p,
      collectionLaunchDate: c.launchDate,
      collectionSaleEnded: c.saleEnded
    })));
    return createCategoryIndicesFromProducts(allProducts);
  }, [collections]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[16/10] rounded-xl bg-gray-800" />
            <div className="mt-3 space-y-2">
              <div className="h-4 bg-gray-800 rounded w-2/3" />
              <div className="h-3 bg-gray-800 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-900 rounded-xl">
        <p className="text-gray-400">No collections available.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
      {collections.map((collection) => (
        <div
          key={collection.id}
          onClick={() => navigate(`/${collection.slug}`)}
          className="cursor-pointer animate-fade-in"
        >
          <CollectionCard 
            collection={collection} 
            categoryIndices={categoryIndices}
            variant="large"
          />
        </div>
      ))}
    </div>
  );
}