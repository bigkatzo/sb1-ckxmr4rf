import React from 'react';
import { Star } from 'lucide-react';

export interface StarButtonProps {
  active: boolean;
  onClick: () => void;
  className?: string;
}

export function StarButton({ active, onClick, className = '' }: StarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-1.5 rounded-lg hover:bg-gray-800 transition-colors ${className}`}
    >
      <Star
        className={`h-4 w-4 ${
          active ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
        }`}
      />
    </button>
  );
}