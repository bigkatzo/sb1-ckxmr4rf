import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Image as ImageIcon, Ban, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFeaturedCollections } from '../../hooks/useFeaturedCollections';
import { CountdownTimer } from '../ui/CountdownTimer';

export function FeaturedCollection() {
  const { collections, loading } = useFeaturedCollections();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const autoScrollTimer = useRef<NodeJS.Timeout>();

  // Required minimum swipe distance in pixels
  const minSwipeDistance = 50;

  // Reset auto-scroll timer
  const resetAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
    }

    if (collections.length <= 1) return;

    autoScrollTimer.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % collections.length);
    }, 10000);
  }, [collections.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(null);
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !isDragging) return;
    
    const currentTouch = e.targetTouches[0].clientX;
    const diff = touchStart - currentTouch;
    setDragOffset(diff);
    setTouchEnd(currentTouch);
  };

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }

    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    setDragOffset(0);
  }, [touchStart, touchEnd]);

  // Initialize auto-scroll
  useEffect(() => {
    resetAutoScroll();
    return () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
      }
    };
  }, [resetAutoScroll]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    resetAutoScroll();
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % collections.length);
    resetAutoScroll();
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + collections.length) % collections.length);
    resetAutoScroll();
  };

  if (loading) {
    return (
      <div className="relative h-[30vh] sm:h-[60vh] md:h-[70vh] overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl animate-pulse bg-gray-800" />
    );
  }

  if (!collections.length) {
    return null;
  }

  const translateX = isDragging 
    ? -(currentIndex * 100) + (dragOffset / window.innerWidth * 100)
    : -(currentIndex * 100);

  return (
    <div className="space-y-2">
      <div className="relative h-[30vh] sm:h-[60vh] md:h-[70vh] overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl group touch-pan-y">
        <div 
          className="flex h-full transition-transform duration-500 ease-out touch-pan-y"
          style={{ 
            transform: `translateX(${translateX}%)`,
            transition: isDragging ? 'none' : 'transform 500ms ease-out'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {collections.map((collection, index) => {
            const isUpcoming = new Date(collection.launchDate) > new Date();
            const isNew = !isUpcoming && (new Date().getTime() - new Date(collection.launchDate).getTime() < 7 * 24 * 60 * 60 * 1000);
            
            return (
              <div 
                key={collection.id} 
                className="relative min-w-full h-full flex-shrink-0 select-none"
              >
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  {collection.imageUrl ? (
                    <img
                      src={collection.imageUrl}
                      alt={collection.name}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <ImageIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-600" />
                  )}
                </div>
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                  {/* Status Tags */}
                  {isUpcoming ? (
                    <>
                      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 md:top-8 md:left-8">
                        <div className="flex items-center gap-2 bg-purple-500/90 backdrop-blur-sm text-white px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="text-sm sm:text-base font-medium">Coming Soon</span>
                        </div>
                      </div>
                      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 md:top-8 md:right-8">
                        <CountdownTimer
                          targetDate={collection.launchDate}
                          className="text-sm sm:text-base md:text-xl text-purple-400 bg-black/50 px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg backdrop-blur-sm"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 md:top-8 md:right-8">
                      {isNew ? (
                        <div className="flex items-center gap-2 bg-green-500/90 backdrop-blur-sm text-white px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg">
                          <span className="text-sm sm:text-base font-medium">New Drop</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-purple-500/90 backdrop-blur-sm text-white px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 rounded-lg">
                          <span className="text-sm sm:text-base font-medium">Featured Drop</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="absolute bottom-4 sm:bottom-6 md:bottom-8 w-full px-4 sm:px-6 md:px-8 space-y-2 sm:space-y-3 md:space-y-4">
                    <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-white max-w-2xl">
                      {collection.name}
                    </h1>
                    
                    <p className="text-xs sm:text-sm md:text-base text-gray-300 max-w-xl line-clamp-2 sm:line-clamp-none">
                      {collection.description}
                    </p>

                    <Link
                      to={`/${collection.slug}`}
                      className="inline-flex items-center space-x-2 rounded-full bg-white px-3 py-1.5 sm:px-4 sm:py-2 md:px-6 md:py-3 text-xs sm:text-sm font-medium text-black transition-colors hover:bg-gray-100"
                      onClick={(e) => {
                        if (isDragging) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <span>View Collection</span>
                      <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Arrows - Hidden on mobile */}
        {collections.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="hidden sm:flex absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={nextSlide}
              className="hidden sm:flex absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Slide Indicators - Now below the slider */}
      {collections.length > 1 && (
        <div className="flex justify-center gap-2">
          {collections.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-gray-800 w-4' : 'bg-gray-400'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}