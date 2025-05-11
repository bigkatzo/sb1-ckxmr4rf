import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useCallback } from 'react';
import { CollectionCard } from './CollectionCard';
import { useCollections } from '../../hooks/useCollections';
import { CategoryGridSkeleton } from '../ui/Skeletons';
import { Button } from '../ui/Button';

interface CollectionGridProps {
  filter: 'upcoming' | 'latest' | 'popular';
  infiniteScroll?: boolean;
}

export function CollectionGrid({ filter, infiniteScroll = filter === 'latest' }: CollectionGridProps) {
  const { 
    collections, 
    loading, 
    loadingMore, 
    hasMore, 
    loadMore 
  } = useCollections(filter, {
    initialLimit: 6,
    loadMoreCount: 6,
    infiniteScroll
  });
  
  const navigate = useNavigate();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Set up intersection observer for infinite scrolling
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    }, { threshold: 0.1 });
    
    if (node) observerRef.current.observe(node);
  }, [loading, loadingMore, hasMore, loadMore]);

  // Clean up observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  if (loading && collections.length === 0) {
    return <CategoryGridSkeleton />;
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-900 rounded-xl">
        <p className="text-gray-400">No collections available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 md:gap-4 lg:gap-5">
        {collections.map((collection, index) => {
          // Calculate row and column position for consistent loading order
          let columns = 1; // Default mobile
          if (window.innerWidth >= 1024) columns = 3; // lg:grid-cols-3
          else if (window.innerWidth >= 640) columns = 2; // sm:grid-cols-2
          
          // Calculate row and column based on index
          const row = Math.floor(index / columns);
          const col = index % columns;
          
          // Set loading priority based on visual position (top-to-bottom, left-to-right)
          // Lower priority value means higher loading priority
          const loadingPriority = row * 100 + col;

          // Determine if this is the last element for infinite scrolling
          const isLastElement = index === collections.length - 1;
          
          return (
            <div
              key={collection.id}
              ref={isLastElement && infiniteScroll ? lastElementRef : null}
              onClick={() => navigate(`/${collection.slug}`)}
              className="cursor-pointer animate-fade-in"
            >
              <CollectionCard 
                collection={collection} 
                variant="large"
                loadingPriority={loadingPriority}
              />
            </div>
          );
        })}
      </div>
      
      {/* Load more button for non-infinite scroll or fallback */}
      {!infiniteScroll && hasMore && (
        <div className="flex justify-center mt-8" ref={loadMoreRef}>
          <Button
            onClick={loadMore}
            variant="outline"
            className="min-w-[200px]"
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load More Collections'}
          </Button>
        </div>
      )}
      
      {/* Loading indicator for infinite scroll */}
      {infiniteScroll && loadingMore && (
        <div className="flex justify-center py-4">
          <div className="animate-pulse flex space-x-2">
            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
          </div>
        </div>
      )}
      
      {/* "No more collections" notice when we've loaded everything */}
      {!hasMore && collections.length > 6 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          No more collections to load
        </div>
      )}
    </div>
  );
}