interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse bg-gray-800/50 rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Image placeholder */}
      <div>
        <div className="h-4 w-24 mb-1">
          <Skeleton className="h-full" />
        </div>
        <Skeleton className="aspect-[4/3] w-full" />
      </div>

      {/* Input fields */}
      {[...Array(4)].map((_, i) => (
        <div key={i}>
          <div className="h-4 w-32 mb-1">
            <Skeleton className="h-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      ))}

      {/* Textarea */}
      <div>
        <div className="h-4 w-32 mb-1">
          <Skeleton className="h-full" />
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
} 