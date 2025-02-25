import React from 'react';
import { Star } from 'lucide-react';
import { Spinner } from './Spinner';

export interface StarButtonProps {
  featured: boolean;
  onClick: () => void;
  loading?: boolean;
  className?: string;
}

export function StarButton({ featured, onClick, loading, className = '' }: StarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`
        p-1.5 rounded-lg transition-colors
        ${featured ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 
                    'bg-gray-800 text-gray-400 hover:bg-gray-700'}
        ${className}
      `}
    >
      {loading ? (
        <Spinner className="h-4 w-4" />
      ) : (
        <Star className={`h-4 w-4 ${featured ? 'fill-current' : ''}`} />
      )}
    </button>
  );
}