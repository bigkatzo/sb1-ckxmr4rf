import { Loader2 } from 'lucide-react';
import { Skeleton } from './Skeleton';

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
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {text && <p className="text-gray-400">{text}</p>}
          </div>
        </div>
      );

    case LoadingType.OVERLAY:
      return (
        <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {text && <p className="text-sm text-gray-200">{text}</p>}
          </div>
        </div>
      );
  }
}; 