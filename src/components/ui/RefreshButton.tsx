import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Loading, LoadingType } from './LoadingStates';

interface RefreshButtonProps {
  onRefresh: () => Promise<void>;
  className?: string;
}

export function RefreshButton({ onRefresh, className = '' }: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-all ${
        isRefreshing ? 'opacity-50' : ''
      } ${className}`}
      title="Refresh"
    >
      {isRefreshing ? (
        <Loading type={LoadingType.ACTION} />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
    </button>
  );
}