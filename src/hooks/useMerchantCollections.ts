import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Collection, CollectionAccess, AccessType } from '../types/collections';
import { normalizeStorageUrl } from '../utils/storage';
import { handleError } from '../utils/error';
import { toast } from 'react-toastify';

// Cache admin status for 5 minutes
const ADMIN_CACHE_DURATION = 5 * 60 * 1000;

// Types for raw database records
type RawCollection = Pick<Collection, 'id' | 'name' | 'description' | 'launch_date' | 'featured' | 'visible' | 'sale_ended' | 'slug' | 'user_id'> & {
  image_url: string | null;
  access_type: AccessType | null;
};

export function useMerchantCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingAccessId, setChangingAccessId] = useState<string | null>(null);
  
  // Use useRef for per-user admin status caching
  const adminCacheRef = useRef<{ [key: string]: { isAdmin: boolean; timestamp: number } }>({});

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

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw authError || new Error('Not authenticated');
      }

      const isAdmin = await checkAdminStatus(user.id);

      // Use the merchant_collections view which handles access control
      const { data: rawCollections, error: collectionsError } = await supabase
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
          access_type
        `)
        .order('created_at', { ascending: false });

      if (collectionsError) throw collectionsError;

      if (!rawCollections?.length) {
        setCollections([]);
        return;
      }

      // Transform and filter collections based on access
      const transformedCollections = rawCollections
        .filter((collection: RawCollection) => {
          // Include collection if:
          // 1. User is the owner
          // 2. User has any access type (view/edit)
          // 3. User is an admin
          return collection.user_id === user.id || 
                 collection.access_type !== null ||
                 isAdmin;
        })
        .map((collection: RawCollection) => ({
          id: collection.id,
          name: collection.name,
          description: collection.description,
          image_url: collection.image_url || '',
          imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
          launch_date: collection.launch_date,
          launchDate: new Date(collection.launch_date),
          featured: collection.featured,
          visible: collection.visible,
          sale_ended: collection.sale_ended,
          saleEnded: collection.sale_ended,
          slug: collection.slug,
          user_id: collection.user_id,
          categories: [],
          products: [],
          accessType: collection.access_type,
          isOwner: collection.user_id === user.id || isAdmin
        }));

      setCollections(transformedCollections);
    } catch (err) {
      console.error('Error fetching merchant collections:', err);
      const errorMessage = handleError(err);
      setError(errorMessage);
      toast.error(`Failed to load collections: ${errorMessage}`);
      setCollections([]);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    fetchCollections();

    // Set up realtime subscription for both collections and collection_access
    const collectionsChannel = supabase.channel('collections_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collections'
        },
        () => fetchCollections()
      )
      .subscribe();

    const accessChannel = supabase.channel('access_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collection_access'
        },
        () => fetchCollections()
      )
      .subscribe();

    return () => {
      // Properly clean up realtime subscriptions
      supabase.removeChannel(collectionsChannel);
      supabase.removeChannel(accessChannel);
    };
  }, [fetchCollections]);

  return { 
    collections, 
    loading, 
    error, 
    refreshCollections: fetchCollections,
    updateCollectionAccess,
    changingAccessId
  };
}