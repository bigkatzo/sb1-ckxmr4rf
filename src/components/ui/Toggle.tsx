import { Switch } from '@headlessui/react';
import { Spinner } from './Spinner';

export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  checked,
  onCheckedChange,
  size = 'md',
  label,
  loading,
  disabled,
  className = ''
}: ToggleProps) {
  const sizeClasses = {
    sm: {
      switch: 'h-5 w-9',
      thumb: 'h-4 w-4',
      translate: 'translate-x-4',
      text: 'text-xs'
    },
    md: {
      switch: 'h-6 w-11',
      thumb: 'h-5 w-5',
      translate: 'translate-x-5',
      text: 'text-sm'
    }
  };

  return (
    <Switch.Group>
      <div className={`flex items-center gap-2 ${className}`}>
        <Switch
          checked={checked}
          onChange={onCheckedChange}
          disabled={loading || disabled}
          className={`
            ${sizeClasses[size].switch}
            ${checked ? 'bg-primary' : 'bg-gray-700'}
            ${(loading || disabled) ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}
            relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent
            transition-colors duration-200 ease-in-out focus:outline-none
          `}
        >
          <span
            className={`
              ${sizeClasses[size].thumb}
              ${checked ? sizeClasses[size].translate : 'translate-x-0'}
              pointer-events-none inline-block transform rounded-full bg-white shadow-lg
              ring-0 transition duration-200 ease-in-out
            `}
          >
            {loading && (
              <Spinner className="absolute inset-0 m-auto h-3 w-3 text-primary" />
            )}
          </span>
        </Switch>
        {label && (
          <Switch.Label className={`${sizeClasses[size].text} text-gray-400 cursor-pointer`}>
            {label}
          </Switch.Label>
        )}
      </div>
    </Switch.Group>
  );
}