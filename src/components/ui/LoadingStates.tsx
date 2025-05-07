import { Loader2 } from 'lucide-react';
import { Skeleton } from './Skeleton';
import { OptimizedImage } from './OptimizedImage';

export enum LoadingType {
  CONTENT = 'content',
  ACTION = 'action',
  PAGE = 'page',
  OVERLAY = 'overlay'
}

interface LoadingProps {
  type: LoadingType;
  className?: string;
  text?: string;
}

export const Loading: React.FC<LoadingProps> = ({ type, className = '', text }) => {
  // Logo URL from Supabase storage - uses currentColor for white fill
  const logoUrl = 'https://sakysysfksculqobozxi.supabase.co/storage/v1/object/public/site-assets/logo-icon.svg';

  // Consistent loader style component to use across different loading types
  const LogoSpinner = ({ 
    size = 'md' as const, 
    containerClassName = '' 
  }: { 
    size?: 'sm' | 'md' | 'lg'; 
    containerClassName?: string 
  }) => {
    const sizeMap = {
      sm: { container: 'h-8 w-8', logo: 'h-5 w-5', inset: '-inset-2' },
      md: { container: 'h-12 w-12', logo: 'h-8 w-8', inset: '-inset-3' },
      lg: { container: 'h-16 w-16', logo: 'h-10 w-10', inset: '-inset-4' }
    };
    
    const { container, logo, inset } = sizeMap[size];
    
    return (
      <div className={`relative ${container} text-white ${containerClassName}`}>
        <OptimizedImage
          src={logoUrl}
          alt="Loading..."
          className={`${logo} absolute inset-0 m-auto animate-pulse`}
          objectFit="contain"
          priority={true}
        />
        <div 
          className={`absolute ${inset} border-t-2 border-primary rounded-full animate-spin`}
          style={{ animationDuration: '1s' }}
        />
      </div>
    );
  };

  switch (type) {
    case LoadingType.CONTENT:
      return <Skeleton className={className} />;
      
    case LoadingType.ACTION:
      return (
        <div className={`inline-flex items-center justify-center gap-2 ${className}`}>
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          {text && <span className="text-sm text-gray-400">{text}</span>}
        </div>
      );
      
    case LoadingType.PAGE:
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-4">
            <LogoSpinner size="md" />
            {text && <p className="text-gray-400">{text}</p>}
          </div>
        </div>
      );

    case LoadingType.OVERLAY:
      return (
        <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <LogoSpinner size="md" />
            {text && <p className="text-sm text-gray-200">{text}</p>}
          </div>
        </div>
      );
  }
}; 