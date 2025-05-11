import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { CollectionCard } from './CollectionCard';
import { useCollections } from '../../hooks/useCollections';
import { CategoryGridSkeleton } from '../ui/Skeletons';
import { Button } from '../ui/Button';
import './loadingDots.css'; // We'll create this CSS file

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
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  // Use one stable effect for setting up and cleaning up the observer
  useEffect(() => {
    // Cleanup function to disconnect any existing observer
    const cleanup = () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
    
    // Don't set up observer if not using infinite scroll or no more content
    if (!infiniteScroll || !hasMore || loading) {
      cleanup();
      return cleanup;
    }
    
    // Wait a bit before setting up to avoid immediate triggering
    const setupTimeout = setTimeout(() => {
      if (!loadMoreTriggerRef.current || loadingMore) return;
      
      cleanup(); // Ensure we don't have multiple observers
      
      // Create new observer
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
            loadMore();
          }
        },
        {
          rootMargin: '200px 0px',
          threshold: 0.1
        }
      );
      
      // Start observing
      observerRef.current.observe(loadMoreTriggerRef.current);
    }, 300);
    
    // Clean up on unmount or when dependencies change
    return () => {
      cleanup();
      clearTimeout(setupTimeout);
    };
  }, [infiniteScroll, hasMore, loading, loadingMore, loadMore]);

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
          
          return (
            <div
              key={collection.id}
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
      
      {/* Load more button for non-infinite scroll mode */}
      {!infiniteScroll && hasMore && (
        <div className="flex justify-center mt-8">
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
      
      {/* Invisible trigger element for infinite scroll - positioned at the bottom */}
      {infiniteScroll && hasMore && (
        <div 
          ref={loadMoreTriggerRef}
          className="h-4" // Reduced height to minimize spacing
          aria-hidden="true"
        />
      )}
      
      {/* Improved loading indicator for infinite scroll */}
      {infiniteScroll && loadingMore && (
        <div className="flex justify-center">
          <div className="loading-dots" aria-label="Loading more collections">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  );
}