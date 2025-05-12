export function FeaturedCollectionSkeleton() {
  return (
    <div className="space-y-2">
      <div 
        className="relative h-[30vh] sm:h-[60vh] md:h-[70vh] overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl"
        style={{ aspectRatio: '16/9' }}
      >
        {/* Background placeholder with subtle gradient animation */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-700">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-600/10 to-transparent skeleton-shimmer" />
        </div>
        
        {/* Content placeholder with gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          {/* Status tag placeholder */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 md:top-8 md:left-8">
            <div className="bg-gray-600/70 backdrop-blur-sm w-32 h-8 sm:w-40 sm:h-10 md:w-48 md:h-12 rounded-2xl animate-pulse" />
          </div>

          {/* Bottom content placeholders */}
          <div className="absolute bottom-4 sm:bottom-6 md:bottom-8 w-full px-4 sm:px-6 md:px-8">
            {/* Title placeholder */}
            <div className="h-7 sm:h-8 md:h-10 lg:h-12 bg-gray-600/70 rounded-lg w-3/4 max-w-lg animate-pulse" />
            
            {/* Button placeholder */}
            <div className="mt-3 sm:mt-4 md:mt-6 inline-flex items-center space-x-2 rounded-full bg-gray-600/70 px-3 py-1.5 sm:px-4 sm:py-2 md:px-6 md:py-3 w-36 sm:w-40 md:w-48 h-8 sm:h-10 md:h-12 animate-pulse">
              <div className="w-full h-full rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Slide indicators placeholder */}
      <div className="flex justify-center gap-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full bg-gray-400 ${i === 0 ? 'w-4 bg-gray-500' : ''}`}
          />
        ))}
      </div>
    </div>
  );
} 