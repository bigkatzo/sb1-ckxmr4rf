import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { Spinner } from './Spinner';

export interface StarButtonProps {
  featured: boolean;
  onClick: () => Promise<void>;
  className?: string;
}

export function StarButton({ featured: initialFeatured, onClick, className = '' }: StarButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [featured, setFeatured] = useState(initialFeatured);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    if (isLoading) return;

    setIsLoading(true);
    // Optimistically update the UI
    setFeatured(!featured);

    try {
      await onClick();
    } catch (error) {
      // Revert on error
      setFeatured(featured);
      console.error('Error toggling featured status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`
        p-1.5 rounded-lg transition-colors
        ${featured ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 
                    'bg-gray-800 text-gray-400 hover:bg-gray-700'}
        ${className}
      `}
    >
      {isLoading ? (
        <Spinner className="h-4 w-4" />
      ) : (
        <Star className={`h-4 w-4 ${featured ? 'fill-current' : ''}`} />
      )}
    </button>
  );
}