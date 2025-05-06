import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { toast } from 'react-toastify';
import { normalizeStorageUrl } from '../lib/storage';
import type { Collection, AccessType } from '../types/collections';

// Cache admin status for 5 minutes
const ADMIN_CACHE_DURATION = 5 * 60 * 1000;

// Global admin status cache
const globalAdminCache: { [key: string]: { isAdmin: boolean; timestamp: number } } = {};

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

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(!deferLoad);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changingAccessId, setChangingAccessId] = useState<string | null>(null);
  
  const checkAdminStatus = useCallback(async (userId: string) => {
    // Return cached value if still valid
    if (adminCacheRef.current[userId] && 
        Date.now() - adminCacheRef.current[userId].timestamp < ADMIN_CACHE_DURATION) {
      return adminCacheRef.current[userId].isAdmin;
    }

    try {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const isAdmin = profile?.role === 'admin';
      
      // Cache the result per user
      adminCacheRef.current[userId] = {
        isAdmin,
        timestamp: Date.now()
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

      const isAdmin = await checkAdminStatus(user.id);
      
      // Fetch collections
      const { data, error } = await supabase
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
          collection_access(user_id, access_type)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data?.length) {
        setCollections([]);
        return;
      }

      // Filter collections based on access
      const filteredCollections = data.filter(collection => {
        return collection.user_id === user.id || 
               collection.access_type !== null ||
               isAdmin;
      });
      
      // Extract collection IDs for fetching counts
      const collectionIds = filteredCollections.map(c => c.id);
      
      // Fetch product and category counts in parallel
      const [productCountMap, categoryCountMap] = await Promise.all([
        fetchProductCounts(collectionIds),
        fetchCategoryCounts(collectionIds)
      ]);

      // Transform collections with counts
      const transformedCollections = filteredCollections.map(collection => ({
        id: collection.id,
        name: collection.name,
        description: collection.description || '',
        image_url: collection.image_url || '',
        imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
        launch_date: collection.launch_date,
        launchDate: collection.launch_date ? new Date(collection.launch_date) : undefined,
        featured: collection.featured || false,
        visible: collection.visible,
        sale_ended: collection.sale_ended,
        saleEnded: collection.sale_ended,
        slug: collection.slug,
        user_id: collection.user_id,
        productCount: productCountMap[collection.id] || 0,
        categoryCount: categoryCountMap[collection.id] || 0,
        accessType: collection.access_type,
        isOwner: collection.user_id === user.id || isAdmin,
        owner_username: collection.owner_username
      } as Collection));

      if (isMountedRef.current) {
        setCollections(transformedCollections);
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