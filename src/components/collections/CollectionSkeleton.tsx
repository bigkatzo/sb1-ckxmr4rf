import { Skeleton } from '../ui/Skeleton';

export function CollectionSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-[50vh] sm:h-[70vh] rounded-xl sm:rounded-2xl" />
      <Skeleton className="h-8 w-48" />
    </div>
  );
}