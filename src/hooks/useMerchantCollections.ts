import { useEffect, useState, useRef } from 'react';
import { useSupabase } from '../contexts/SupabaseContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchCollections } from '../services/collections';
import type { Collection as CollectionType } from '../types/collections';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CollectionCache {
  data: CollectionType[];
  timestamp: number;
}

export function useMerchantCollections() {
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const [collections, setCollections] = useState<CollectionType[]>([]);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef<CollectionCache | null>(null);

  const loadCollections = async () => {
    try {
      setLoading(true);
      // Check cache first
      if (cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_DURATION) {
        setCollections(cacheRef.current.data);
        return;
      }

      const rawData = await fetchCollections(supabase);
      
      // Transform the data to match the Collection interface
      const transformedData: CollectionType[] = rawData.map(collection => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        image_url: collection.image_url,
        imageUrl: collection.image_url,
        launch_date: collection.launch_date,
        launchDate: new Date(collection.launch_date),
        featured: collection.featured || false,
        visible: collection.visible || true,
        sale_ended: collection.sale_ended || false,
        saleEnded: collection.sale_ended || false,
        slug: collection.slug || '',
        user_id: collection.user_id,
        categories: [],
        products: [],
        accessType: collection.isOwner ? 'edit' : collection.accessType || null,
        isOwner: collection.isOwner || false,
        owner_username: null,
        collection_access: []
      }));

      setCollections(transformedData);
      cacheRef.current = {
        data: transformedData,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error loading collections:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setCollections([]);
      setLoading(false);
      return;
    }

    loadCollections();
  }, [user, supabase]);

  return { collections, loading, refetch: loadCollections };
}