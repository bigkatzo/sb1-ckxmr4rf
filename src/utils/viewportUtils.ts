/**
 * Viewport detection utilities for optimizing resource loading
 */

import { useEffect, useState } from 'react';

// Viewport height multiplier for "above the fold" content
// 1.5 means we consider content within 1.5x the viewport height to be initially visible
const VIEWPORT_MULTIPLIER = 1.5;

/**
 * Checks if an element's position would place it in the initial viewport
 * Used to prioritize loading of visible images
 */
export function useIsInInitialViewport(
  ref: React.RefObject<HTMLElement>, 
  offset: number = 0,
  multiplier: number = VIEWPORT_MULTIPLIER
): boolean {
  const [isInViewport, setIsInViewport] = useState(false);

  useEffect(() => {
    const calculatePosition = () => {
      if (!ref.current) return false;
      
      // Get element position
      const rect = ref.current.getBoundingClientRect();
      
      // Get viewport height
      const viewportHeight = window.innerHeight;
      
      // Calculate the threshold - the multiplier determines how far down we consider "initial viewport"
      const viewportThreshold = viewportHeight * multiplier;
      
      // Check if element is visible in the initial viewport area
      return rect.top < viewportThreshold + offset;
    };

    // Check position immediately
    setIsInViewport(calculatePosition());
    
    // No need for resize handler since we only care about initial position
  }, [ref, offset, multiplier]);

  return isInViewport;
}

/**
 * Returns a reasonable estimate of whether an element at the provided
 * index in a grid/list would be visible in the initial viewport
 */
export function estimateIsInInitialViewport(
  index: number,
  columnsPerRow: number = 3,
  itemHeight: number = 350, // Approximate height of grid items in pixels
  headerHeight: number = 200 // Approximate height of content above the grid
): boolean {
  // Return true for first N items that would likely be visible
  if (typeof window === 'undefined') return index < columnsPerRow * 2; // Server-side render assumption
  
  const viewportHeight = window.innerHeight;
  const effectiveViewportHeight = viewportHeight * VIEWPORT_MULTIPLIER; 
  
  // Calculate how many rows would be visible
  const visibleHeight = effectiveViewportHeight - headerHeight;
  const visibleRows = Math.ceil(visibleHeight / itemHeight);
  
  // Calculate how many items would be in the visible rows
  const visibleItems = visibleRows * columnsPerRow;
  
  return index < visibleItems;
} 