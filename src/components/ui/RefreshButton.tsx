import { RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface RefreshButtonProps {
  onRefresh: () => void;
  className?: string;
  loading?: boolean;
}

export function RefreshButton({ onRefresh, className = '', loading = false }: RefreshButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loading) {
      onRefresh();
    }
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="ghost"
      className={`${className} relative ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-700'}`}
      disabled={loading}
      title="Refresh data"
    >
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
    </Button>
  );
}