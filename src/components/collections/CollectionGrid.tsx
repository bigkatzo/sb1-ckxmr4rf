import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { CollectionCard } from './CollectionCard';
import { useCollections } from '../../hooks/useCollections';
import { CategoryGridSkeleton } from '../ui/Skeletons';
import { Button } from '../ui/Button';
import { smoothScrollOnNewContent } from '../../utils/scrollUtils';
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
  const gridRef = useRef<HTMLDivElement>(null);
  const prevCollectionsLength = useRef<number>(0);
  
  // Effect for handling new content loading
  useEffect(() => {
    if (prevCollectionsLength.current < collections.length && !loading) {
      // Smooth scroll when new collections are loaded
      smoothScrollOnNewContent(gridRef.current);
      prevCollectionsLength.current = collections.length;
    }
  }, [collections.length, loading]);
  
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
    
    if (!loadMoreTriggerRef.current || loadingMore) return cleanup;
    
    cleanup(); // Ensure we don't have multiple observers
    
    // Create new observer with improved configuration
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      {
        rootMargin: '400px 0px', // Increased rootMargin for earlier loading
        threshold: 0.1
      }
    );
    
    // Start observing
    observerRef.current.observe(loadMoreTriggerRef.current);
    
    // Clean up on unmount or when dependencies change
    return cleanup;
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
      <div 
        ref={gridRef}
        className={`grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 md:gap-4 lg:gap-5 ${loadingMore ? 'staggered-fade-in' : ''}`}
        style={{ contain: 'content' }} // Use the standard 'contain' property instead of 'containment'
      >
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
              className="cursor-pointer new-item-reveal"
              style={{
                animationDelay: `${(index % 6) * 0.05}s`,
                contain: 'content'
              }}
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
          className="h-4 w-full overflow-hidden" // Added w-full and overflow-hidden
          style={{ contain: 'layout size' }} // Added contain property for better performance
          aria-hidden="true"
        />
      )}
      
      {/* Improved loading indicator for infinite scroll */}
      {infiniteScroll && loadingMore && (
        <div className="loading-indicator w-full overflow-hidden">
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