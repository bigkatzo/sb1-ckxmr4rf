import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Image as ImageIcon, Ban, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFeaturedCollections } from '../../hooks/useFeaturedCollections';
import { CountdownTimer } from '../ui/CountdownTimer';

export function FeaturedCollection() {
  const { collections, loading } = useFeaturedCollections();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-advance the slider every 5 seconds
  useEffect(() => {
    if (collections.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % collections.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [collections.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % collections.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + collections.length) % collections.length);
  };

  if (loading) {
    return (
      <div className="relative h-[50vh] sm:h-[60vh] md:h-[70vh] overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl animate-pulse bg-gray-800" />
    );
  }

  if (!collections.length) {
    return null;
  }

  const featured = collections[currentIndex];
  const isUpcoming = new Date(featured.launchDate) > new Date();

  return (
    <div className="relative h-[50vh] sm:h-[60vh] md:h-[70vh] overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl group">
      <div className="relative h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
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
          {(isUpcoming || featured.saleEnded) && (
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
                ) : featured.saleEnded && (
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
              {featured.saleEnded && (
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

      {/* Navigation Arrows */}
      {collections.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Slide Indicators */}
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2">
            {collections.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? 'bg-white w-4' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}