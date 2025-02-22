import React from 'react';
import { Switch } from '@headlessui/react';
import { Loader2 } from 'lucide-react';

export interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function Toggle({ checked, onChange, loading, className = '', children }: ToggleProps) {
  return (
    <Switch
      checked={checked}
      onChange={onChange}
      disabled={loading}
      className={`${
        checked ? 'bg-purple-600' : 'bg-gray-700'
      } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 ${className}`}
    >
      <span className="sr-only">{children}</span>
      <span
        className={`${
          checked ? 'translate-x-6' : 'translate-x-1'
        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
      />
      {loading && (
        <Loader2 className="absolute right-1 h-4 w-4 animate-spin text-purple-300" />
      )}
    </Switch>
  );
}