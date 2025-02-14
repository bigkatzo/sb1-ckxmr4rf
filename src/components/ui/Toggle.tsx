import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Toggle({ 
  checked, 
  onChange, 
  label, 
  description, 
  disabled = false,
  size = 'md'
}: ToggleProps) {
  const switchClasses = size === 'sm' 
    ? 'h-5 w-9' 
    : 'h-6 w-11';
  
  const thumbClasses = size === 'sm'
    ? 'h-4 w-4 translate-x-4'
    : 'h-5 w-5 translate-x-5';

  return (
    <div className="flex items-start">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`
          relative inline-flex flex-shrink-0 cursor-pointer rounded-full 
          border-2 border-transparent transition-colors duration-200 ease-in-out 
          focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 
          ${checked ? 'bg-purple-600' : 'bg-gray-700'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${switchClasses}
        `}
      >
        <span
          aria-hidden="true"
          className={`
            pointer-events-none inline-block transform rounded-full 
            bg-white shadow ring-0 transition duration-200 ease-in-out
            ${checked ? thumbClasses : 'translate-x-0'}
            ${size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'}
          `}
        />
      </button>
      <div className="ml-3">
        <span className={`font-medium ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{label}</span>
        {description && (
          <p className={`text-gray-400 ${size === 'sm' ? 'text-[10px]' : 'text-sm'}`}>{description}</p>
        )}
      </div>
    </div>
  );
}