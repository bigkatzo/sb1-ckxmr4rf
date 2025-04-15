import { useNavigate } from 'react-router-dom';
import { CollectionCard } from './CollectionCard';
import { useCollections } from '../../hooks/useCollections';
import { CategoryGridSkeleton } from '../ui/Skeletons';

interface CollectionGridProps {
  filter: 'upcoming' | 'latest' | 'popular';
}

export function CollectionGrid({ filter }: CollectionGridProps) {
  const { collections, loading } = useCollections(filter);
  const navigate = useNavigate();

  if (loading) {
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
  );
}