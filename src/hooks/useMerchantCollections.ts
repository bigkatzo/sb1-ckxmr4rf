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
};

type AccessRecord = Omit<CollectionAccess, 'access_type'> & {
  access_type: Exclude<AccessType, null>;
  created_at?: string;
  updated_at?: string;
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

      // Fetch collections and access records in parallel
      const [collectionsResponse, accessResponse] = await Promise.all([
        supabase
          .from('collections')
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
            user_id
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('collection_access')
          .select('id, collection_id, user_id, access_type')
      ]) as [
        { data: RawCollection[] | null, error: any },
        { data: AccessRecord[] | null, error: any }
      ];

      if (collectionsResponse.error) throw collectionsResponse.error;
      if (accessResponse.error) throw accessResponse.error;

      const rawCollections = collectionsResponse.data;
      if (!rawCollections?.length) {
        setCollections([]);
        return;
      }

      const accessRecords = accessResponse.data || [];

      // Transform data
      const transformedCollections = rawCollections.map((collection) => {
        const userAccess = accessRecords.find(
          a => a.collection_id === collection.id && a.user_id === user.id
        );
        const accessType = (isAdmin || collection.user_id === user.id) ? null : (userAccess?.access_type || null);

        return {
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
          accessType,
          collection_access: accessRecords.filter(a => a.collection_id === collection.id) as CollectionAccess[]
        };
      });

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

  const updateCollectionAccess = useCallback(async (
    collectionId: string,
    userId: string,
    accessType: AccessType
  ) => {
    try {
      setChangingAccessId(collectionId);

      // Check if user has permission to modify access
      const collection = collections.find(c => c.id === collectionId);
      if (!collection) throw new Error('Collection not found');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const isAdmin = await checkAdminStatus(user.id);
      if (!isAdmin && collection.user_id !== user.id) {
        throw new Error('You do not have permission to modify access for this collection');
      }

      const { error } = accessType === null
        ? await supabase
            .from('collection_access')
            .delete()
            .match({ collection_id: collectionId, user_id: userId })
        : await supabase
            .from('collection_access')
            .upsert({
              collection_id: collectionId,
              user_id: userId,
              access_type: accessType
            });

      if (error) throw error;

      await fetchCollections();
      toast.success('Collection access updated successfully');
    } catch (err) {
      console.error('Error updating collection access:', err);
      const errorMessage = handleError(err);
      toast.error(`Failed to update access: ${errorMessage}`);
      throw err;
    } finally {
      setChangingAccessId(null);
    }
  }, [collections, checkAdminStatus, fetchCollections]);

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