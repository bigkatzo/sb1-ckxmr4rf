import { Skeleton } from './Skeleton';

export function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-gray-900 rounded-lg overflow-hidden">
          <div className="aspect-square">
            <Skeleton className="w-full h-full" />
          </div>
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrderListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-gray-900 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-3/4 mb-1.5" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CategoryGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-gray-900 p-4 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 flex-1" />
          </div>
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function SearchResultsSkeleton() {
  return (
    <div className="absolute top-full mt-2 w-full bg-gray-900 rounded-lg shadow-lg border border-gray-800 py-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="px-3 py-2">
          <div className="flex items-center space-x-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BestSellersSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-gray-900 rounded-lg overflow-hidden">
          <div className="aspect-square">
            <Skeleton className="w-full h-full" />
          </div>
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CollectionScrollerSkeleton() {
  return (
    <div className="relative">
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[280px] sm:w-[320px]">
            <div className="aspect-[16/10]">
              <Skeleton className="w-full h-full rounded-xl" />
            </div>
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductModalSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-900 rounded-lg mx-4">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <div className="p-4 space-y-6">
          {/* Image gallery */}
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-4 aspect-square">
              <Skeleton className="w-full h-full rounded-lg" />
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="aspect-square">
                <Skeleton className="w-full h-full rounded-lg" />
              </div>
            ))}
          </div>
          
          {/* Product info */}
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-24 w-full" />
          </div>
          
          {/* Variants */}
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          </div>
          
          {/* Order progress */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-3">
            <Skeleton className="h-12 flex-1 rounded-lg" />
            <Skeleton className="h-12 w-12 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrderProgressBarSkeleton() {
  return (
    <div className="space-y-3 bg-gray-900 rounded-lg p-4">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-full rounded-full" />
      </div>
      <div className="flex justify-between text-sm">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
} 