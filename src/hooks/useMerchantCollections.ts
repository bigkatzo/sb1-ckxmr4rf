import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { toast } from 'react-toastify';
import { normalizeStorageUrl } from '../lib/storage';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import type { Collection, AccessType } from '../types/collections';

// Cache admin status for 5 minutes
const ADMIN_CACHE_DURATION = 5 * 60 * 1000;

// Global admin status cache
const globalAdminCache: { [key: string]: { isAdmin: boolean; timestamp: number } } = {};

// Cache key for merchant collections
const getMerchantCollectionsCacheKey = (userId: string) => `merchant_collections:${userId}`;

// Get Supabase URL and key from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function useMerchantCollections(options: {
  deferLoad?: boolean;
  elementRef?: React.RefObject<HTMLDivElement>;
} = {}) {
  const { 
    deferLoad = false
  } = options;

  // Move useRef hooks inside the component
  const adminCacheRef = useRef(globalAdminCache);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout>();
  const cacheKeyRef = useRef<string | null>(null);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(!deferLoad);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changingAccessId, setChangingAccessId] = useState<string | null>(null);
  
  const checkAdminStatus = useCallback(async (userId: string) => {
    if (!userId) return false;

    // Check in-memory cache first
    const now = Date.now();
    const cachedAdmin = adminCacheRef.current[userId];
    if (cachedAdmin && now - cachedAdmin.timestamp < ADMIN_CACHE_DURATION) {
      return cachedAdmin.isAdmin;
    }

    try {
      // Query user profile to check admin status
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) throw error;
      const isAdmin = profile?.role === 'admin';

      // Update cache
      adminCacheRef.current[userId] = {
        isAdmin,
        timestamp: now
      };

      return isAdmin;
    } catch (err) {
      console.error('Error checking admin status:', err);
      return false;
    }
  }, []);

  // Helper function to fetch product counts for collections
  const fetchProductCounts = async (collectionIds: string[]) => {
    if (!collectionIds.length) return {};
    
    try {
      // Use raw query for counting
      const { data, error } = await supabase.rpc('get_product_counts_by_collection', {
        collection_ids: collectionIds
      });

      if (error) {
        console.error('Error calling get_product_counts_by_collection:', error);
        
        // Fallback: query each collection individually
        const productCountMap: Record<string, number> = {};
        
        // Create a map with all IDs initialized to 0
        collectionIds.forEach(id => {
          productCountMap[id] = 0;
        });
        
        // Try to get counts for each collection individually
        await Promise.all(collectionIds.map(async (collectionId) => {
          try {
            const { count, error } = await supabase
              .from('products')
              .select('*', { count: 'exact', head: true })
              .eq('collection_id', collectionId);
              
            if (!error && count !== null) {
              productCountMap[collectionId] = count;
            }
          } catch (e) {
            console.error(`Error counting products for collection ${collectionId}:`, e);
          }
        }));
        
        return productCountMap;
      }

      // Create a map of collection_id to count
      const productCountMap: Record<string, number> = {};
      if (Array.isArray(data)) {
        data.forEach((item: { collection_id: string; count: number }) => {
          productCountMap[item.collection_id] = item.count;
        });
      }

      return productCountMap;
    } catch (err) {
      console.error('Error fetching product counts:', err);
      return {};
    }
  };

  // Helper function to fetch category counts for collections
  const fetchCategoryCounts = async (collectionIds: string[]) => {
    if (!collectionIds.length) return {};
    
    try {
      // Use raw query for counting
      const { data, error } = await supabase.rpc('get_category_counts_by_collection', {
        collection_ids: collectionIds
      });

      if (error) {
        console.error('Error calling get_category_counts_by_collection:', error);
        
        // Fallback: query each collection individually
        const categoryCountMap: Record<string, number> = {};
        
        // Create a map with all IDs initialized to 0
        collectionIds.forEach(id => {
          categoryCountMap[id] = 0;
        });
        
        // Try to get counts for each collection individually
        await Promise.all(collectionIds.map(async (collectionId) => {
          try {
            const { count, error } = await supabase
              .from('categories')
              .select('*', { count: 'exact', head: true })
              .eq('collection_id', collectionId);
              
            if (!error && count !== null) {
              categoryCountMap[collectionId] = count;
            }
          } catch (e) {
            console.error(`Error counting categories for collection ${collectionId}:`, e);
          }
        }));
        
        return categoryCountMap;
      }

      // Create a map of collection_id to count
      const categoryCountMap: Record<string, number> = {};
      if (Array.isArray(data)) {
        data.forEach((item: { collection_id: string; count: number }) => {
          categoryCountMap[item.collection_id] = item.count;
        });
      }

      return categoryCountMap;
    } catch (err) {
      console.error('Error fetching category counts:', err);
      return {};
    }
  };

  const fetchCollections = useCallback(async (isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (!isRefresh) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw authError || new Error('Not authenticated');
      }

      // Set up cache key
      const cacheKey = getMerchantCollectionsCacheKey(user.id);
      cacheKeyRef.current = cacheKey;

      // Check if we can use cached data (only if not explicitly refreshing)
      if (!isRefresh) {
        const { value: cachedData, needsRevalidation } = await cacheManager.get<Collection[]>(cacheKey);
        
        if (cachedData) {
          // Use cached data immediately
          setCollections(cachedData);
          setLoading(false);
          
          // If data needs revalidation, fetch fresh data in background
          if (needsRevalidation) {
            // Continue with the fetch but don't show loading state
            setRefreshing(true);
          } else {
            // If data is fresh, return early
            isFetchingRef.current = false;
            return;
          }
        }
      }

      const isAdmin = await checkAdminStatus(user.id);
      
      // Fetch collections with error handling
      let result;
      try {
        result = await supabase
          .from('merchant_collections')
          .select(`
            id,
            name,
            description,
            image_url,
            launch_date,
            featured,
            visible,
            sale_ended,
            slug,
            user_id,
            access_type,
            owner_username,
            owner_merchant_tier,
            collection_access(user_id, access_type),
            custom_url,
            x_url,
            telegram_url,
            dexscreener_url,
            pumpfun_url,
            website_url,
            free_notes,
            ca,
            strict_token,
            theme_primary_color,
            theme_secondary_color,
            theme_background_color,
            theme_text_color,
            theme_use_custom,
            theme_use_classic,
            theme_logo_url
          `)
          .order('created_at', { ascending: false });
      } catch (initialError) {
        console.error('Error fetching collections:', initialError);
        
        // If it's likely a 400 error, try a direct fetch with fixed URL formatting
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No authentication session');
          
          // Build a proper URL manually
          const url = `${SUPABASE_URL}/rest/v1/merchant_collections?select=id,name,description,image_url,launch_date,featured,visible,sale_ended,slug,user_id,access_type,owner_username,owner_merchant_tier,collection_access(user_id,access_type),custom_url,x_url,telegram_url,dexscreener_url,pumpfun_url,website_url,free_notes,ca,strict_token,theme_primary_color,theme_secondary_color,theme_background_color,theme_text_color,theme_use_custom,theme_use_classic,theme_logo_url&order=created_at.desc`;
          
          const response = await fetch(url, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) throw new Error(`API request failed: ${response.status}`);
          
          const data = await response.json();
          result = { data, error: null };
        } catch (fallbackError) {
          console.error('Fallback collections query error:', fallbackError);
          throw initialError; // Re-throw the original error if fallback fails
        }
      }
      
      const { data, error } = result;
      if (error) throw error;

      if (!data?.length) {
        setCollections([]);
        
        // Cache empty array too
        if (cacheKeyRef.current) {
          cacheManager.set(
            cacheKeyRef.current,
            [],
            CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
            { staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE }
          );
        }
        
        return;
      }

      // Filter collections based on access
      const filteredCollections = data.filter((collection: any) => {
          return collection.user_id === user.id || 
                 collection.access_type !== null ||
                 isAdmin;
      });
      
      // Extract collection IDs for fetching counts
      const collectionIds = filteredCollections.map((c: any) => c.id);
      
      // Fetch product and category counts in parallel
      const [productCountMap, categoryCountMap] = await Promise.all([
        fetchProductCounts(collectionIds),
        fetchCategoryCounts(collectionIds)
      ]);

      // Transform collections with counts
      const transformedCollections = filteredCollections.map((collection: any) => {
        return {
          id: collection.id,
          name: collection.name,
          description: collection.description || '',
          image_url: collection.image_url || '',
          imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
          launch_date: collection.launch_date,
          launchDate: collection.launch_date 
            ? new Date(collection.launch_date) // Database provides proper UTC string
            : new Date(),
          featured: collection.featured || false,
          visible: collection.visible,
          sale_ended: collection.sale_ended,
          saleEnded: collection.sale_ended,
          slug: collection.slug,
          user_id: collection.user_id,
          custom_url: collection.custom_url || '',
          x_url: collection.x_url || '',
          telegram_url: collection.telegram_url || '',
          dexscreener_url: collection.dexscreener_url || '',
          ca: collection.ca || '',
          strict_token: collection.strict_token || '',
          pumpfun_url: collection.pumpfun_url || '',
          website_url: collection.website_url || '',
          free_notes: collection.free_notes || '',
          // Theme fields
          theme_primary_color: collection.theme_primary_color || null,
          theme_secondary_color: collection.theme_secondary_color || null,
          theme_background_color: collection.theme_background_color || null,
          theme_text_color: collection.theme_text_color || null,
          theme_use_custom: collection.theme_use_custom || false,
          theme_use_classic: collection.theme_use_classic !== false,
          theme_logo_url: collection.theme_logo_url || null,
          productCount: productCountMap[collection.id] || 0,
          categoryCount: categoryCountMap[collection.id] || 0,
          accessType: collection.access_type,
          isOwner: collection.user_id === user.id || isAdmin,
          owner_username: collection.owner_username,
          ownerMerchantTier: collection.owner_merchant_tier
        } as Collection;
      });

      if (isMountedRef.current) {
        setCollections(transformedCollections);
        
        // Cache the result
        if (cacheKeyRef.current) {
          cacheManager.set(
            cacheKeyRef.current,
            transformedCollections,
            CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
            { staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE }
          );
        }
      }
    } catch (err) {
      console.error('Error fetching collections:', err);
      const errorMessage = handleError(err);
      if (isMountedRef.current) {
        setError(errorMessage);
        setCollections([]);
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [checkAdminStatus]);

  const updateCollectionAccess = useCallback(async (collectionId: string, userId: string, accessType: AccessType | null) => {
    try {
      setChangingAccessId(collectionId);

      if (accessType === null) {
        // Remove access
        const { error } = await supabase
          .from('collection_access')
          .delete()
          .match({ collection_id: collectionId, user_id: userId });

        if (error) throw error;
      } else {
        // Upsert access
        const { error } = await supabase
          .from('collection_access')
          .upsert({
            collection_id: collectionId,
            user_id: userId,
            access_type: accessType
          });

        if (error) throw error;
      }

      // Invalidate the collections cache
      if (cacheKeyRef.current) {
        cacheManager.invalidateKey(cacheKeyRef.current);
      }

      await fetchCollections();
      toast.success('Collection access updated successfully');
    } catch (err) {
      console.error('Error updating collection access:', err);
      const errorMessage = handleError(err);
      toast.error(`Failed to update collection access: ${errorMessage}`);
    } finally {
      setChangingAccessId(null);
    }
  }, [fetchCollections]);

  // Initial fetch if not deferred
  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch if not deferred
    if (!deferLoad) {
      fetchCollections(false);
    }

    return () => {
      isMountedRef.current = false;
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchCollections, deferLoad]);

  return { 
    collections,
    loading,
    refreshing,
    error,
    refetch: () => fetchCollections(true),
    changingAccessId,
    updateCollectionAccess
  };
}