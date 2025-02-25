import React from 'react';
import { Trash2 } from 'lucide-react';
import { Spinner } from './Spinner';
import { cn } from '../../utils/cn';

export interface DeleteButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DeleteButton({ onClick, loading, disabled, className = '' }: DeleteButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`
        p-1.5 rounded-lg transition-colors
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-500/20'}
        bg-gray-800 text-red-400
        ${className}
      `}
    >
      {loading ? (
        <Spinner className="h-4 w-4" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}