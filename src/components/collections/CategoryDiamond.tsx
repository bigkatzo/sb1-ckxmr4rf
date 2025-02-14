import React from 'react';
import { Diamond } from 'lucide-react';
import { getCategoryColorSet } from '../../utils/category-colors';

interface CategoryDiamondProps {
  type: string;
  index: number;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CategoryDiamond({ 
  type, 
  index = 0, 
  selected = false, 
  size = 'md', 
  className = '' 
}: CategoryDiamondProps) {
  // Get color set with safe fallback
  const colorSet = getCategoryColorSet(index);

  // Get size class based on prop
  const sizeClass = React.useMemo(() => {
    switch (size) {
      case 'sm': return 'h-4 w-4';
      case 'lg': return 'h-6 w-6';
      default: return 'h-5 w-5';
    }
  }, [size]);

  return (
    <div className={`relative ${className}`}>
      <Diamond 
        className={`
          ${sizeClass}
          ${selected ? colorSet.light : colorSet.base}
          transition-colors duration-200
        `}
        fill={selected ? 'currentColor' : 'none'}
        strokeWidth={selected ? 1.5 : 2}
      />
    </div>
  );
}