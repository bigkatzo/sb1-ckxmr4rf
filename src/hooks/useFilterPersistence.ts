import { useState, useEffect } from 'react';

/**
 * Hook for persisting filter settings in localStorage
 * 
 * @param key The key prefix for localStorage (will be combined with id)
 * @param id The unique identifier for this set of filters (e.g., collection ID)
 * @param initialState The initial state for the filters
 * @returns [filterState, setFilterState, resetFilters] tuple
 */
export function useFilterPersistence<T>(
  key: string,
  id: string,
  initialState: T
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [filterState, setFilterState] = useState<T>(initialState);

  // Load persisted filter settings when ID changes
  useEffect(() => {
    if (!id) return;
    
    const storageKey = `${key}_${id}`;
    const savedFilters = localStorage.getItem(storageKey);
    
    if (savedFilters) {
      try {
        const parsedFilters = JSON.parse(savedFilters);
        setFilterState(parsedFilters);
      } catch (error) {
        console.error(`Error parsing saved filters for ${storageKey}:`, error);
        // Reset filters if there's an error
        setFilterState(initialState);
      }
    } else {
      // Reset filters if none found for this ID
      setFilterState(initialState);
    }
  }, [id, key, initialState]);

  // Persist filter settings
  useEffect(() => {
    if (!id) return;
    
    const storageKey = `${key}_${id}`;
    localStorage.setItem(storageKey, JSON.stringify(filterState));
  }, [filterState, id, key]);

  // Reset filters function
  const resetFilters = () => {
    setFilterState(initialState);
  };

  return [filterState, setFilterState, resetFilters];
} 