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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
      {collections.map((collection) => (
        <div
          key={collection.id}
          onClick={() => navigate(`/${collection.slug}`)}
          className="cursor-pointer animate-fade-in"
        >
          <CollectionCard 
            collection={collection} 
            variant="large"
          />
        </div>
      ))}
    </div>
  );
}