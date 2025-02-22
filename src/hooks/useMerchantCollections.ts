import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
import type { Collection } from '../types';

interface CollectionAccess {
  access_type: 'view' | 'edit';
  user_id: string;
}

export function useMerchantCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      // Get user profile to check if admin
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const isAdmin = profile?.role === 'admin';

      let query = supabase
        .from('collections')
        .select(`
          *,
          collection_access!inner (
            access_type,
            user_id
          )
        `);

      // If not admin, only fetch collections the user has access to
      if (!isAdmin) {
        query = query.or(`user_id.eq.${user.id}, collection_access.user_id.eq.${user.id}`);
      }

      query = query.order('created_at', { ascending: false });

      const { data: allCollections, error: collectionsError } = await query;

      if (collectionsError) throw collectionsError;
      
      const transformedCollections = (allCollections || []).map(collection => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
        launchDate: new Date(collection.launch_date),
        featured: collection.featured,
        visible: collection.visible,
        saleEnded: collection.sale_ended,
        slug: collection.slug,
        categories: [],
        products: [],
        // Add access type information - admin has owner access to all collections
        accessType: isAdmin || collection.user_id === user.id ? 'owner' as const : 
                   ((collection.collection_access as CollectionAccess[])?.find(access => access.user_id === user.id)?.access_type || null) as ('view' | 'edit' | null)
      }));

      setCollections(transformedCollections);
    } catch (err) {
      console.error('Error fetching merchant collections:', err);
      setError(handleError(err));
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();

    // Set up realtime subscription
    const channel = supabase.channel('merchant_collections')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collections'
        },
        async () => {
          await fetchCollections();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchCollections]);

  return { collections, loading, error, refreshCollections: fetchCollections };
}