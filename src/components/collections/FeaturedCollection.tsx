import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFeaturedCollections } from '../../hooks/useFeaturedCollections';
import { CountdownTimer } from '../ui/CountdownTimer';
import { OptimizedImage } from '../ui/OptimizedImage';
import { CollectionBadge } from '../ui/CollectionBadge';
import { FeaturedCollectionSkeleton } from './FeaturedCollectionSkeleton';

// Keep track of whether the component has been loaded before
// This is outside the component to persist across re-renders
let hasLoadedBefore = false;

export function FeaturedCollection() {
  const { collections, loading } = useFeaturedCollections();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [dragVelocity, setDragVelocity] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'horizontal' | 'vertical' | null>(null);
  const [contentLoaded, setContentLoaded] = useState(hasLoadedBefore);
  const isFirstLoad = !hasLoadedBefore;
  const autoScrollTimer = useRef<NodeJS.Timeout>();
  const sliderRef = useRef<HTMLDivElement>(null);
  const mouseDownPos = useRef<number | null>(null);
  const isAnimating = useRef(false);

  // Required minimum swipe distance in pixels
  const minSwipeDistance = 50;
  // Velocity threshold for momentum scrolling (pixels per millisecond)
  const velocityThreshold = 0.5;
  // Angle threshold for determining vertical vs horizontal movement (in degrees)
  const angleThreshold = 30;

  // Mark content as loaded after initial delay for smooth transition
  useEffect(() => {
    if (!loading && collections.length > 0 && !contentLoaded) {
      // Remove the artificial delay - load immediately
      setContentLoaded(true);
      // Set global flag so future renders don't show the fade
      hasLoadedBefore = true;
    }
  }, [loading, collections, contentLoaded]);

  // Reset auto-scroll timer
  const resetAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
    }

    if (collections.length <= 1) return;

    autoScrollTimer.current = setInterval(() => {
      if (!isDragging && !isAnimating.current) {
        setCurrentIndex((prev) => (prev + 1) % collections.length);
      }
    }, 10000);
  }, [collections.length, isDragging]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimating.current) return;
    
    const touch = e.targetTouches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
    setIsDragging(true);
    setDragOffset(0);
    setDragStartTime(Date.now());
    setScrollDirection(null);
    isAnimating.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !isDragging) return;
    
    const touch = e.targetTouches[0];
    const touchDeltaX = touch.clientX - touchStart.x;
    const touchDeltaY = touch.clientY - touchStart.y;
    
    // Calculate angle of movement
    const angle = Math.abs(Math.atan2(touchDeltaY, touchDeltaX) * 180 / Math.PI);
    
    // Determine scroll direction if not already set
    if (!scrollDirection) {
      if (angle > 90 - angleThreshold && angle < 90 + angleThreshold) {
        setScrollDirection('vertical');
      } else {
        setScrollDirection('horizontal');
      }
    }
    
    // Only handle horizontal scrolling if that's the determined direction
    if (scrollDirection === 'horizontal') {
      e.preventDefault();
      
      // Add resistance at the edges with smoother transition
      if ((currentIndex === 0 && touchDeltaX > 0) || 
          (currentIndex === collections.length - 1 && touchDeltaX < 0)) {
        setDragOffset(touchDeltaX * 0.2); // Reduced resistance for smoother feel
      } else {
        setDragOffset(touchDeltaX * 0.8); // Add slight resistance for smoother movement
      }
      
      setTouchEnd(touch.clientX);
    }
  };

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd || !isDragging) return;

    const distance = touchEnd - touchStart.x;
    const isLeftSwipe = distance < -minSwipeDistance;
    const isRightSwipe = distance > minSwipeDistance;
    
    // Calculate velocity for momentum scrolling
    const endTime = Date.now();
    const duration = endTime - dragStartTime;
    const velocity = Math.abs(distance) / duration;
    setDragVelocity(velocity);
    
    isAnimating.current = true;
    
    if (scrollDirection === 'horizontal' && (isLeftSwipe || (velocity > velocityThreshold && distance < 0))) {
      nextSlide();
    } else if (scrollDirection === 'horizontal' && (isRightSwipe || (velocity > velocityThreshold && distance > 0))) {
      prevSlide();
    } else {
      // Snap back to current slide with smooth transition
      setDragOffset(0);
      setTimeout(() => {
        isAnimating.current = false;
      }, 50);
    }

    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    setScrollDirection(null);
  }, [touchStart, touchEnd, dragStartTime, isDragging, collections.length, scrollDirection]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isAnimating.current) return;
    
    mouseDownPos.current = e.clientX;
    setIsDragging(true);
    setDragOffset(0);
    setDragStartTime(Date.now());
    isAnimating.current = false;
    
    // Add event listeners to document to track mouse movement even outside the slider
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevent default to avoid text selection during drag
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (mouseDownPos.current === null || !isDragging) return;
    
    // Prevent default to ensure smooth dragging
    e.preventDefault();
    
    // Invert the diff calculation to match the natural swipe direction
    const diff = e.clientX - mouseDownPos.current;
    
    // Add resistance at the edges (with inverted logic)
    if ((currentIndex === 0 && diff > 0) || 
        (currentIndex === collections.length - 1 && diff < 0)) {
      setDragOffset(diff * 0.3); // Apply resistance
    } else {
      setDragOffset(diff);
    }
  }, [isDragging, currentIndex, collections.length]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!mouseDownPos.current || !isDragging) return;
    
    // Calculate distance and velocity
    const distance = e.clientX - mouseDownPos.current;
    const endTime = Date.now();
    const duration = endTime - dragStartTime;
    const velocity = Math.abs(distance) / duration;
    setDragVelocity(velocity);
    
    isAnimating.current = true;
    
    if (Math.abs(distance) < minSwipeDistance && velocity < velocityThreshold) {
      // If the drag was small and slow, treat it as a click
      setDragOffset(0);
      setTimeout(() => {
        isAnimating.current = false;
      }, 50);
    } else if (distance < -minSwipeDistance || (velocity > velocityThreshold && distance < 0)) {
      nextSlide();
    } else if (distance > minSwipeDistance || (velocity > velocityThreshold && distance > 0)) {
      prevSlide();
    } else {
      // Snap back to current slide if swipe wasn't strong enough
      setDragOffset(0);
      setTimeout(() => {
        isAnimating.current = false;
      }, 50);
    }

    setIsDragging(false);
    mouseDownPos.current = null;
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [dragStartTime, isDragging, collections.length]);

  // Cleanup mouse events on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Initialize auto-scroll
  useEffect(() => {
    resetAutoScroll();
    
    // Add passive touch event listeners to the slider element for better performance
    const sliderElement = sliderRef.current;
    if (sliderElement) {
      const passiveListener = { passive: false };
      sliderElement.addEventListener('touchstart', handleTouchStart as unknown as EventListener, passiveListener);
      sliderElement.addEventListener('touchmove', handleTouchMove as unknown as EventListener, passiveListener);
      sliderElement.addEventListener('touchend', handleTouchEnd as unknown as EventListener);
      sliderElement.addEventListener('touchcancel', handleTouchEnd as unknown as EventListener);
    }
    
    return () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
      }
      
      // Clean up event listeners
      if (sliderElement) {
        sliderElement.removeEventListener('touchstart', handleTouchStart as unknown as EventListener);
        sliderElement.removeEventListener('touchmove', handleTouchMove as unknown as EventListener);
        sliderElement.removeEventListener('touchend', handleTouchEnd as unknown as EventListener);
        sliderElement.removeEventListener('touchcancel', handleTouchEnd as unknown as EventListener);
      }
    };
  }, [resetAutoScroll, handleTouchEnd]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating.current) return;
      
      if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        nextSlide();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [collections.length]);

  const goToSlide = (index: number) => {
    isAnimating.current = true;
    setCurrentIndex(index);
    resetAutoScroll();
    setTimeout(() => {
      isAnimating.current = false;
    }, 50); // Reduced to 50ms for very fast response
  };

  const nextSlide = () => {
    isAnimating.current = true;
    setCurrentIndex((prev) => (prev + 1) % collections.length);
    resetAutoScroll();
    setDragOffset(0);
    setTimeout(() => {
      isAnimating.current = false;
    }, 50); // Reduced to 50ms for very fast response
  };

  const prevSlide = () => {
    isAnimating.current = true;
    setCurrentIndex((prev) => (prev - 1 + collections.length) % collections.length);
    resetAutoScroll();
    setDragOffset(0);
    setTimeout(() => {
      isAnimating.current = false;
    }, 50); // Reduced to 50ms for very fast response
  };

  if (loading && !contentLoaded) {
    return <FeaturedCollectionSkeleton />;
  }

  if (!collections.length) {
    return null;
  }

  // Calculate transition speed based on velocity for momentum effect
  const transitionDuration = isDragging ? 0 : (dragVelocity > velocityThreshold ? 250 : 400);
  
  // Apply a slight damping effect to make the drag feel more natural
  const dampingFactor = 0.92;
  
  const translateX = isDragging 
    ? -(currentIndex * 100) + (dragOffset * dampingFactor / (sliderRef.current?.clientWidth || window.innerWidth) * 100)
    : -(currentIndex * 100);

  return (
    <div className={isFirstLoad && !contentLoaded ? "space-y-2 opacity-0" : "space-y-2"} 
         style={isFirstLoad && contentLoaded ? {
           transition: "opacity 300ms ease-out",
           opacity: 1
         } : undefined}>
      <div 
        ref={sliderRef}
        className="relative h-[30vh] sm:h-[60vh] md:h-[70vh] overflow-hidden rounded-lg sm:rounded-xl md:rounded-2xl group cursor-grab active:cursor-grabbing select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div 
          className="flex h-full"
          style={{ 
            transform: `translateX(${translateX}%)`,
            transition: isDragging ? 'none' : `transform ${transitionDuration}ms cubic-bezier(0.2, 0.82, 0.2, 1)`,
            height: '100%',
            width: '100%'
          }}
        >
          {collections.map((collection, index) => {
            const isUpcoming = new Date(collection.launchDate) > new Date();
            const isNew = !isUpcoming && (new Date().getTime() - new Date(collection.launchDate).getTime() < 7 * 24 * 60 * 60 * 1000);
            
            return (
              <div 
                key={collection.id} 
                className="relative min-w-full h-full flex-shrink-0 cursor-pointer"
                onClick={() => {
                  // Only navigate if we haven't dragged significantly
                  if (!isDragging || Math.abs(dragOffset) < minSwipeDistance) {
                    navigate(`/${collection.slug}`);
                  }
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  {collection.imageUrl ? (
                    <OptimizedImage
                      src={collection.imageUrl}
                      alt={collection.name}
                      width={1200}
                      height={675}
                      quality={90}
                      className="absolute inset-0 h-full w-full object-cover"
                      sizes="100vw"
                      priority={index === currentIndex}
                      loading={index === currentIndex ? "eager" : "lazy"} 
                      fetchPriority={index === currentIndex ? "high" : "auto"}
                      style={{ aspectRatio: '16/9' }}
                      onLoad={() => {
                        if (index === currentIndex && !contentLoaded) {
                          setContentLoaded(true);
                        }
                      }}
                    />
                  ) : (
                    <ImageIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-600" />
                  )}
                </div>
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                  {/* Status Tags - All in top left corner */}
                  <div className="absolute top-3 left-3 sm:top-4 sm:left-4 md:top-8 md:left-8 flex flex-col gap-2">
                    {isUpcoming ? (
                      <>
                        {/* Desktop/Tablet: Combined tag */}
                        <div className="hidden sm:flex items-center gap-2 bg-primary/90 backdrop-blur-sm text-white px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-2xl">
                          <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="text-sm sm:text-base font-medium">Coming Soon</span>
                          <span className="mx-2 w-px h-5 bg-white/30" />
                          <CountdownTimer
                            targetDate={collection.launchDate}
                            className="text-sm sm:text-base text-primary-light"
                          />
                        </div>
                        {/* Mobile: Side by side tags */}
                        <div className="sm:hidden flex items-center gap-1.5">
                          <div className="flex items-center gap-1.5 bg-primary/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-xl">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">Coming Soon</span>
                          </div>
                          <CountdownTimer
                            targetDate={collection.launchDate}
                            className="text-xs text-primary bg-black/50 px-2.5 py-1 rounded-lg backdrop-blur-sm"
                          />
                        </div>
                      </>
                    ) : (
                      <div className={`flex items-center gap-2 ${isNew ? 'bg-green-500/90' : 'bg-secondary'} backdrop-blur-sm text-white px-2.5 py-1 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-xl sm:rounded-2xl`}>
                        <span className="text-xs sm:text-base font-medium">{isNew ? 'New Drop' : 'Featured Drop'}</span>
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-4 sm:bottom-6 md:bottom-8 w-full px-4 sm:px-6 md:px-8">
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 md:mb-6">
                      <h1 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-white max-w-2xl">
                        {collection.name}
                      </h1>
                      <CollectionBadge 
                        merchantTier={(collection as any).ownerMerchantTier || 'elite_merchant'} 
                        className="text-lg sm:text-xl md:text-2xl lg:text-3xl"
                        showTooltip={true}
                      />
                    </div>

                    <Link
                      to={`/${collection.slug}`}
                      className="mt-3 sm:mt-4 md:mt-6 inline-flex items-center space-x-2 rounded-full bg-white px-3 py-1.5 sm:px-4 sm:py-2 md:px-6 md:py-3 text-xs sm:text-sm font-medium text-black transition-all hover:bg-gray-100 hover:scale-105"
                      onClick={(e) => {
                        // Prevent navigation if we're dragging
                        if (isDragging && Math.abs(dragOffset) > minSwipeDistance) {
                          e.preventDefault();
                          e.stopPropagation();
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
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={nextSlide}
              className="hidden sm:flex absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              aria-label="Next slide"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Slide Indicators - Now below the slider */}
      {collections.length > 1 && (
        <div className="flex justify-center gap-2">
          {collections.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentIndex ? 'bg-gray-800 w-4' : 'bg-gray-400 hover:bg-gray-600'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}