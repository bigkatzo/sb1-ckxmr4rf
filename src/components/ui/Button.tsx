import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { Loading, LoadingType } from './LoadingStates';
import { cn } from '../../utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  variant = 'primary',
  size = 'md',
  isLoading,
  loadingText,
  disabled,
  children,
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50';
  
  const variants = {
    primary: 'bg-purple-600 text-white hover:bg-purple-700',
    secondary: 'bg-gray-800 text-white hover:bg-gray-700',
    outline: 'border border-gray-700 hover:bg-gray-800',
    ghost: 'hover:bg-gray-800',
    link: 'underline-offset-4 hover:underline text-purple-500'
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4',
    lg: 'h-12 px-6 text-lg'
  };

  return (
    <button
      ref={ref}
      disabled={isLoading || disabled}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="opacity-0">{children}</span>
          <span className="absolute inset-0 flex items-center justify-center gap-2">
            <Loading type={LoadingType.ACTION} />
            {loadingText && <span>{loadingText}</span>}
          </span>
        </>
      ) : children}
    </button>
  );
});

Button.displayName = 'Button';

export { Button }; 