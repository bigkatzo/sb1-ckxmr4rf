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

  switch (type) {
    case LoadingType.CONTENT:
      return <Skeleton className={className} />;
      
    case LoadingType.ACTION:
      return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
          <Loader2 className="h-4 w-4 animate-spin" />
          {text && <span className="text-sm text-gray-400">{text}</span>}
        </div>
      );
      
    case LoadingType.PAGE:
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-12 w-12 text-white">
              <OptimizedImage
                src={logoUrl}
                alt="Loading..."
                className="h-full w-full animate-pulse"
                objectFit="contain"
              />
              <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin" 
                style={{ animationDuration: '1s' }}
              />
            </div>
            {text && <p className="text-gray-400">{text}</p>}
          </div>
        </div>
      );

    case LoadingType.OVERLAY:
      return (
        <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-12 w-12 text-white">
              <OptimizedImage
                src={logoUrl}
                alt="Loading..."
                className="h-full w-full animate-pulse"
                objectFit="contain"
              />
              <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin" 
                style={{ animationDuration: '1s' }}
              />
            </div>
            {text && <p className="text-sm text-gray-200">{text}</p>}
          </div>
        </div>
      );
  }
}; 