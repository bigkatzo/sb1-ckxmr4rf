import { OptimizedImage } from './OptimizedImage';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'colored';
}

export function Logo({ className = '', size = 'md', variant = 'default' }: LogoProps) {
  // Size mappings for the logo - refined for more consistent proportions
  const sizeClasses = {
    sm: 'h-5 sm:h-6',  // Smaller for footer, compact areas
    md: 'h-7 sm:h-9',  // Standard size for header
    lg: 'h-9 sm:h-12'  // Larger for hero sections or features
  };

  // Color variants - default is white, colored can be used on light backgrounds
  const colorClasses = {
    default: 'text-white',
    colored: 'text-primary'
  };

  // Single logo URL - SVG uses currentColor so we control color via CSS
  const logoUrl = 'https://sakysysfksculqobozxi.supabase.co/storage/v1/object/public/site-assets/logo.svg';

  return (
    <div className={`inline-flex items-center justify-start p-0 m-0 ${sizeClasses[size]} ${colorClasses[variant]} ${className}`}>
      <OptimizedImage
        src={logoUrl}
        alt="store.fun"
        className="h-full w-auto max-w-full object-contain p-0 m-0" 
        objectFit="contain"
        priority={true}
      />
    </div>
  );
}