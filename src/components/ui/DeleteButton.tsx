import React from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface DeleteButtonProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

export function DeleteButton({ onClick, className, disabled }: DeleteButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-1 hover:bg-gray-800 rounded transition-colors text-red-500 hover:text-red-400",
        disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-red-500",
        className
      )}
      title="Delete"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}