import { useRef } from 'react';
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
  const navigate = useNavigate();
  const { collections, loading } = useCollections(filter);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.clientWidth;
    const scrollAmount = direction === 'left' ? -(containerWidth * 0.8) : containerWidth * 0.8;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
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
        {collections.map((collection) => (
          <div
            key={collection.id}
            className="flex-shrink-0 w-[280px] sm:w-[320px] snap-start cursor-pointer"
            onClick={() => navigate(`/${collection.slug}`)}
          >
            <CollectionCard 
              collection={collection} 
              variant="small"
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