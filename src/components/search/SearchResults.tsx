import { Image as ImageIcon } from 'lucide-react';
import type { SearchResult } from '../../types';
import { OptimizedImage } from '../ui/OptimizedImage';
import { SearchResultsSkeleton } from '../ui/Skeletons';

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  onSelect: (slug: string) => void;
}

export function SearchResults({ results, loading, onSelect }: SearchResultsProps) {
  if (loading) {
    return <SearchResultsSkeleton />;
  }

  if (results.length === 0) {
    return (
      <div className="absolute top-full mt-2 w-full bg-gray-900 rounded-lg shadow-lg border border-gray-800 py-2">
        <div className="px-3 py-2 text-sm text-gray-400">
          No collections found
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-full mt-2 w-full bg-gray-900 rounded-lg shadow-lg border border-gray-800 py-2">
      {results.map((result) => (
        <button
          key={result.id}
          onClick={() => onSelect(result.slug)}
          className="w-full px-3 py-2 flex items-center space-x-3 hover:bg-gray-800 transition-colors"
        >
          {result.imageUrl ? (
            <div className="h-10 w-10 flex-shrink-0 rounded bg-gray-800 overflow-hidden">
              <OptimizedImage
                src={result.imageUrl}
                alt={result.name}
                width={80}
                height={80}
                quality={75}
                className="w-full h-full object-cover"
                sizes="40px"
              />
            </div>
          ) : (
            <div className="h-10 w-10 flex-shrink-0 rounded bg-gray-800 flex items-center justify-center">
              <ImageIcon className="h-5 w-5 text-gray-600" />
            </div>
          )}
          <div className="flex-1 text-left">
            <div className="text-sm font-medium">{result.name}</div>
            <div className="text-xs text-gray-400 line-clamp-1">
              {result.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}