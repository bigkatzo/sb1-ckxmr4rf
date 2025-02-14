import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CollectionCard } from './CollectionCard';
import { useCollections } from '../../hooks/useCollections';
import { createCategoryIndicesFromProducts } from '../../utils/category-mapping';

interface CollectionScrollerProps {
  filter: 'upcoming' | 'latest' | 'popular';
}

export function CollectionScroller({ filter }: CollectionScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { collections, loading } = useCollections(filter);
  const categoryIndices = React.useMemo(() => {
    const allProducts = collections.flatMap(c => {
      // Add collection launch date to each product
      return c.products.map(p => ({
        ...p,
        collectionLaunchDate: c.launchDate
      }));
    });
    return createCategoryIndicesFromProducts(allProducts);
  }, [collections]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = direction === 'left' ? -400 : 400;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="relative">
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[280px] sm:w-[320px] aspect-[16/10] animate-pulse rounded-xl bg-gray-800"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!collections?.length) {
    return null;
  }

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
      >
        {collections.map((collection) => (
          <div
            key={collection.id}
            onClick={() => navigate(`/${collection.slug}`)}
            className="flex-shrink-0 w-[280px] sm:w-[320px] cursor-pointer"
          >
            <CollectionCard 
              collection={collection} 
              categoryIndices={categoryIndices}
              variant="large"
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => scroll('left')}
        className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black transition-all disabled:opacity-0"
        disabled={loading}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => scroll('right')}
        className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black transition-all disabled:opacity-0"
        disabled={loading}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}