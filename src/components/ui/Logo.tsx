import { OptimizedImage } from './OptimizedImage';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'colored';
}

export function Logo({ className = '', size = 'md', variant = 'default' }: LogoProps) {
  // Size mappings for the logo
  const sizeClasses = {
    sm: 'h-5 sm:h-6',
    md: 'h-6 sm:h-8',
    lg: 'h-8 sm:h-10'
  };

  // Color variants - default is white, colored can be used on light backgrounds
  const colorClasses = {
    default: 'text-white',
    colored: 'text-primary'
  };

  // Single logo URL - SVG uses currentColor so we control color via CSS
  const logoUrl = 'https://sakysysfksculqobozxi.supabase.co/storage/v1/object/public/site-assets/logo.svg';

  return (
    <div className={`inline-flex items-center ${sizeClasses[size]} ${colorClasses[variant]} ${className}`}>
      <OptimizedImage
        src={logoUrl}
        alt="store.fun"
        className="h-full w-auto max-w-full"
        objectFit="contain"
        priority={true}
      />
    </div>
  );
}