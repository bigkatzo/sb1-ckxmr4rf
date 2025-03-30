import { RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface RefreshButtonProps {
  onRefresh: () => void;
  className?: string;
  loading?: boolean;
}

export function RefreshButton({ onRefresh, className = '', loading = false }: RefreshButtonProps) {
  return (
    <Button
      onClick={onRefresh}
      size="sm"
      variant="ghost"
      className={`${className} ${loading ? 'animate-spin' : ''}`}
      disabled={loading}
    >
      <RefreshCw className="h-4 w-4" />
    </Button>
  );
}