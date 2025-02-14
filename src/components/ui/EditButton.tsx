import React from 'react';
import { Pencil } from 'lucide-react';

interface EditButtonProps {
  onClick: () => void;
  className?: string;
}

export function EditButton({ onClick, className = '' }: EditButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors ${className}`}
    >
      <Pencil className="h-4 w-4" />
    </button>
  );
}