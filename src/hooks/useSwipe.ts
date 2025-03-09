import { useState, useCallback } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50 }: SwipeHandlers) {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isVerticalScroll, setIsVerticalScroll] = useState(false);

  // Velocity threshold for momentum scrolling (pixels per millisecond)
  const velocityThreshold = 0.5;
  // Minimum distance to determine scroll direction
  const directionThreshold = 10;

  const onTouchStart = useCallback((e: TouchEvent | React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
    setDragStartTime(Date.now());
    setIsDragging(true);
    setDragOffset(0);
    setIsVerticalScroll(false);
  }, []);

  const onTouchMove = useCallback((e: TouchEvent | React.TouchEvent) => {
    if (!touchStart || !isDragging) return;

    const currentTouch = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };

    // Calculate horizontal and vertical movement
    const deltaX = currentTouch.x - touchStart.x;
    const deltaY = Math.abs(currentTouch.y - touchStart.y);

    // Determine scroll direction if not yet determined
    if (!isVerticalScroll && (Math.abs(deltaX) > directionThreshold || deltaY > directionThreshold)) {
      setIsVerticalScroll(deltaY > Math.abs(deltaX));
    }

    // If vertical scrolling is detected, don't prevent default and don't update swipe state
    if (isVerticalScroll) return;

    // Prevent default to avoid page scrolling during horizontal swipe
    e.preventDefault();

    // Only update touchEnd if horizontal movement is significant
    if (Math.abs(deltaX) > directionThreshold) {
      setTouchEnd(currentTouch);
      setDragOffset(deltaX);
    }
  }, [touchStart, isDragging, isVerticalScroll]);

  const onTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd || !isDragging || isVerticalScroll) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = Math.abs(touchStart.y - touchEnd.y);

    // Calculate velocity for momentum scrolling
    const endTime = Date.now();
    const duration = endTime - dragStartTime;
    const velocity = Math.abs(distanceX) / duration;

    // Only trigger swipe if horizontal movement is greater than vertical
    // and greater than threshold, or if velocity is high enough
    if (Math.abs(distanceX) > distanceY && 
        (Math.abs(distanceX) > threshold || velocity > velocityThreshold)) {
      if (distanceX > 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (distanceX < 0 && onSwipeRight) {
        onSwipeRight();
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    setDragOffset(0);
    setIsVerticalScroll(false);
  }, [touchStart, touchEnd, threshold, onSwipeLeft, onSwipeRight, dragStartTime, isDragging, isVerticalScroll]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    isDragging,
    dragOffset
  };
}