import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CollectionCard } from './CollectionCard';
import { useCollections } from '../../hooks/useCollections';
import { CollectionScrollerSkeleton } from '../ui/Skeletons';

interface CollectionScrollerProps {
  filter: 'upcoming' | 'latest' | 'popular';
}

export function CollectionScroller({ filter }: CollectionScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { collections, loading } = useCollections(filter);
  const navigate = useNavigate();
  const [touchStartTime, setTouchStartTime] = useState<Record<string, number>>({});
  const [touchStartPosition, setTouchStartPosition] = useState<Record<string, {x: number, y: number}>>({});

  // No need for visibleCount as we're using index-based loading priority
  // This simplifies the component without changing functionality

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.clientWidth;
    const scrollAmount = direction === 'left' ? -(containerWidth * 0.8) : containerWidth * 0.8;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const handleCollectionClick = (collectionSlug: string) => {
    navigate(`/${collectionSlug}`);
  };

  // Touch event handlers for better mobile experience
  const handleTouchStart = (e: React.TouchEvent, collectionId: string) => {
    setTouchStartTime(prev => ({
      ...prev,
      [collectionId]: Date.now()
    }));
    setTouchStartPosition(prev => ({
      ...prev,
      [collectionId]: {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      }
    }));
  };

  const handleTouchEnd = (e: React.TouchEvent, collectionId: string, collectionSlug: string) => {
    const startTime = touchStartTime[collectionId];
    const startPosition = touchStartPosition[collectionId];
    
    if (!startTime || !startPosition) return;
    
    // Calculate touch duration and distance
    const touchDuration = Date.now() - startTime;
    const touchEndPosition = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };
    
    const distance = Math.sqrt(
      Math.pow(touchEndPosition.x - startPosition.x, 2) +
      Math.pow(touchEndPosition.y - startPosition.y, 2)
    );
    
    // If it was a quick tap (less than 300ms) and didn't move much (less than 10px),
    // consider it a tap and navigate to the collection
    if (touchDuration < 300 && distance < 10) {
      handleCollectionClick(collectionSlug);
    }
    
    // Reset touch state for this collection
    setTouchStartTime(prev => {
      const newState = {...prev};
      delete newState[collectionId];
      return newState;
    });
    setTouchStartPosition(prev => {
      const newState = {...prev};
      delete newState[collectionId];
      return newState;
    });
  };

  if (loading) {
    return <CollectionScrollerSkeleton />;
  }

  if (!collections?.length) {
    return null;
  }

  return (
    <div className="relative group">
      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
      >
        {collections.map((collection, index) => (
          <div
            key={collection.id}
            className="flex-shrink-0 w-[280px] sm:w-[320px] snap-start cursor-pointer touch-manipulation"
            onClick={() => handleCollectionClick(collection.slug)}
            onTouchStart={(e) => handleTouchStart(e, collection.id)}
            onTouchEnd={(e) => handleTouchEnd(e, collection.id, collection.slug)}
          >
            <CollectionCard 
              collection={collection} 
              variant="small"
              loadingPriority={index}
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