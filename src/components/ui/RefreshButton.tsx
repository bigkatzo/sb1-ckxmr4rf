import React, { useState } from 'react';
import { RotateCw } from 'lucide-react';

interface RefreshButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onRefresh: () => void | Promise<void>;
}

export function RefreshButton({ onRefresh, className = '', ...props }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-400 ${className}`}
      {...props}
    >
      <RotateCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
    </button>
  );
}