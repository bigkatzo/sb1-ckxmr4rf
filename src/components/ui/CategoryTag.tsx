import React from 'react';
import { Tag } from 'lucide-react';

interface CategoryTagProps {
  name: string;
  type: string;
  className?: string;
}

export function CategoryTag({ name, type, className = '' }: CategoryTagProps) {
  const getTypeColor = () => {
    switch (type) {
      case 'whitelist':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'rules-based':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default:
        return 'bg-green-500/10 text-green-500 border-green-500/20';
    }
  };

  return (
    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full border ${getTypeColor()} ${className}`}>
      <Tag className="w-3 h-3" />
      <span className="text-xs font-medium">{name}</span>
    </div>
  );
}