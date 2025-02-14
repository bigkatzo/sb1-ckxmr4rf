import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Image as ImageIcon, Ban } from 'lucide-react';
import { useFeaturedCollections } from '../../hooks/useFeaturedCollections';
import { CountdownTimer } from '../ui/CountdownTimer';

export function FeaturedCollection() {
  const { collections, loading } = useFeaturedCollections();
  const featured = collections[0];

  if (loading) {
    return (
      <div className="relative h-[50vh] sm:h-[60vh] md:h-[70vh] overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl animate-pulse bg-gray-800" />
    );
  }

  if (!featured) {
    return null;
  }

  const isUpcoming = new Date(featured.launchDate) > new Date();

  return (
    <div className="relative h-[50vh] sm:h-[60vh] md:h-[70vh] overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl">
      {featured.imageUrl ? (
        <img
          src={featured.imageUrl}
          alt={featured.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
          <ImageIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-600" />
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        {(isUpcoming || featured.sale_ended) && (
          <>
            {isUpcoming && (
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 md:top-8 md:right-8">
                <CountdownTimer
                  targetDate={featured.launchDate}
                  className="text-sm sm:text-base md:text-xl text-purple-400 bg-black/50 px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg backdrop-blur-sm"
                />
              </div>
            )}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 md:top-8 md:left-8">
              {isUpcoming ? (
                <div className="flex items-center gap-2 bg-purple-500/90 backdrop-blur-sm text-white px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm sm:text-base font-medium">Coming Soon</span>
                </div>
              ) : featured.sale_ended && (
                <div className="flex items-center gap-2 bg-red-500/90 backdrop-blur-sm text-white px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg">
                  <Ban className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-sm sm:text-base font-medium">Sale Ended</span>
                </div>
              )}
            </div>
          </>
        )}

        <div className="absolute bottom-0 w-full p-4 sm:p-6 md:p-8 space-y-2 sm:space-y-3 md:space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="inline-block rounded-full bg-purple-500 px-2 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-medium">
              Featured Drop
            </span>
            {isUpcoming && (
              <span className="inline-block rounded-full bg-purple-500/20 text-purple-300 px-2 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-medium">
                Upcoming
              </span>
            )}
            {featured.sale_ended && (
              <span className="inline-block rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-medium">
                Sale Ended
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-white max-w-2xl">
            {featured.name}
          </h1>
          
          <p className="text-xs sm:text-sm md:text-base text-gray-300 max-w-xl line-clamp-2 sm:line-clamp-none">
            {featured.description}
          </p>

          <Link
            to={`/${featured.slug}`}
            className="inline-flex items-center space-x-2 rounded-full bg-white px-3 py-1.5 sm:px-4 sm:py-2 md:px-6 md:py-3 text-xs sm:text-sm font-medium text-black transition-colors hover:bg-gray-100"
          >
            <span>View Collection</span>
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}