import React from 'react';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function TextArea({ label, className = '', ...props }: TextAreaProps) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium mb-1">
          {label}
        </label>
      )}
      <textarea
        className={`w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 ${className}`}
        rows={3}
        {...props}
      />
    </div>
  );
} 