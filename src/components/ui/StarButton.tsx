import React from 'react';
import { Star } from 'lucide-react';

interface StarButtonProps {
  featured: boolean;
  onClick: () => void;
  className?: string;
}

export function StarButton({ featured, onClick, className = '' }: StarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${
        featured 
          ? 'text-yellow-400 hover:text-yellow-500 bg-yellow-400/10 hover:bg-yellow-400/20' 
          : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
      } ${className}`}
      title={featured ? 'Remove from featured' : 'Add to featured'}
    >
      <Star className="h-4 w-4" fill={featured ? 'currentColor' : 'none'} />
    </button>
  );
}