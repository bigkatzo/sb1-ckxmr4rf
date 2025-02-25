import React from 'react';
import { Edit2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface EditButtonProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

export function EditButton({ onClick, className, disabled }: EditButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-1 hover:bg-gray-800 rounded transition-colors",
        disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
        className
      )}
      title="Edit"
    >
      <Edit2 className="h-4 w-4" />
    </button>
  );
}