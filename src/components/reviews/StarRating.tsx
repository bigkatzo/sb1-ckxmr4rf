import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  className?: string;
  showValue?: boolean;
}

export function StarRating({ 
  rating, 
  maxRating = 5, 
  size = 'md', 
  interactive = false, 
  onRatingChange,
  className = '',
  showValue = false
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const starSize = sizeClasses[size];

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {[...Array(maxRating)].map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= rating;
        
        return (
          <button
            key={index}
            type="button"
            onClick={() => interactive && onRatingChange?.(starValue)}
            disabled={!interactive}
            className={`
              ${starSize} transition-colors relative
              ${interactive ? 'cursor-pointer hover:text-yellow-400 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-opacity-50 rounded' : 'cursor-default'}
              ${isFilled ? 'text-yellow-400' : 'text-gray-400'}
            `}
            aria-label={`${starValue} star${starValue !== 1 ? 's' : ''}`}
          >
            <Star className={`w-full h-full ${isFilled ? 'fill-current' : ''}`} />
          </button>
        );
      })}
      {showValue && (
        <span className="ml-2 text-sm text-gray-300">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
} 