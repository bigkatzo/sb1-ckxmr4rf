import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Collection, CollectionAccess, AccessType } from '../types/collections';
import { normalizeStorageUrl } from '../utils/storage';
import { handleError } from '../utils/error';
import { toast } from 'react-toastify';

// Cache admin status for 5 minutes
const ADMIN_CACHE_DURATION = 5 * 60 * 1000;
let adminStatusCache: { isAdmin: boolean; timestamp: number } | null = null;

export function useMerchantCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingAccessId, setChangingAccessId] = useState<string | null>(null);

  // Function to check admin status with caching
  const checkAdminStatus = useCallback(async (userId: string) => {
    // Return cached value if still valid
    if (adminStatusCache && Date.now() - adminStatusCache.timestamp < ADMIN_CACHE_DURATION) {
      return adminStatusCache.isAdmin;
    }

    try {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const isAdmin = profile?.role === 'admin';
      
      // Cache the result
      adminStatusCache = {
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
      if (authError) throw authError;
      if (!user) {
        setCollections([]);
        return;
      }

      const isAdmin = await checkAdminStatus(user.id);

      // Fetch collections with all necessary data
      const baseQuery = supabase
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
          user_id,
          collection_access!left (
            id,
            user_id,
            access_type
          )
        `)
        .order('created_at', { ascending: false });

      // If not admin, add filter for user's collections
      const { data: allCollections, error: collectionsError } = await (isAdmin 
        ? baseQuery 
        : baseQuery.or(`user_id.eq.${user.id},collection_access.user_id.eq.${user.id}`));

      if (collectionsError) throw collectionsError;

      const transformedCollections = (allCollections || []).map(collection => {
        // Determine access type
        let accessType: AccessType = 'view';
        
        if (isAdmin || collection.user_id === user.id) {
          accessType = 'owner';
        } else {
          const userAccess = collection.collection_access?.find(
            (access: CollectionAccess) => access.user_id === user.id
          );
          accessType = userAccess?.access_type || null;
        }

        return {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
          launchDate: new Date(collection.launch_date),
          featured: collection.featured,
          visible: collection.visible,
          saleEnded: collection.sale_ended,
          slug: collection.slug,
          user_id: collection.user_id,
          categories: [],
          products: [],
          accessType,
          collection_access: collection.collection_access
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
    accessType: Exclude<AccessType, 'owner'> | null
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
      collectionsChannel.unsubscribe();
      accessChannel.unsubscribe();
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