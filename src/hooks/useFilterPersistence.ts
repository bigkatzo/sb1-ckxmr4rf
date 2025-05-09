import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Utility function to clear all persisted filters for a specific user ID
 * This should be called when a user logs out
 * 
 * @param userId The user ID to clear filters for
 */
export function clearUserFilters(userId: string | null): void {
  if (!userId) return;
  
  // Get all localStorage keys
  const keys = Object.keys(localStorage);
  
  // Filter keys that start with the userId prefix
  const userKeys = keys.filter(key => key.startsWith(`${userId}_`));
  
  // Remove all matching keys
  userKeys.forEach(key => localStorage.removeItem(key));
}

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
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user ID
  useEffect(() => {
    const getUserId = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || null);
    };
    
    getUserId();
  }, []);

  // Load persisted filter settings when ID changes
  useEffect(() => {
    if (!id || !userId) return;
    
    const storageKey = `${userId}_${key}_${id}`;
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
  }, [id, key, initialState, userId]);

  // Persist filter settings
  useEffect(() => {
    if (!id || !userId) return;
    
    const storageKey = `${userId}_${key}_${id}`;
    localStorage.setItem(storageKey, JSON.stringify(filterState));
  }, [filterState, id, key, userId]);

  // Reset filters function
  const resetFilters = () => {
    setFilterState(initialState);
  };

  return [filterState, setFilterState, resetFilters];
} 