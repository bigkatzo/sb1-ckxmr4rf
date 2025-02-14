import React from 'react';
import { Trash2 } from 'lucide-react';

interface DeleteButtonProps {
  onClick: () => void;
  className?: string;
}

export function DeleteButton({ onClick, className = '' }: DeleteButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors ${className}`}
      title="Delete"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}