import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { toast } from 'react-toastify';
import { isRealtimeConnectionHealthy } from '../lib/realtime/subscriptions';
import { normalizeStorageUrl } from '../lib/storage';
import type { Collection, AccessType } from '../types/collections';

// Cache admin status for 5 minutes
const ADMIN_CACHE_DURATION = 5 * 60 * 1000;

// Priority levels for subscriptions
const SUBSCRIPTION_PRIORITY = {
  HIGH: 2,   // Active merchant view
  MEDIUM: 1, // Background merchant view
  LOW: 0     // Inactive view
} as const;

// Global subscription tracking
const activeSubscriptions = new Map<string, {
  cleanup: () => void,
  priority: number,
  lastAccessed: number
}>();

// Track subscription attempts to prevent duplicates
const subscriptionAttempts = new Map<string, number>();
const MAX_SUBSCRIPTION_ATTEMPTS = 3;

// Track subscription priorities
const subscriptionPriorities = new Map<string, number>();

// Function to update subscription priority
function updateSubscriptionPriority(collectionId: string, priority: number) {
  subscriptionPriorities.set(collectionId, priority);
  const subscription = activeSubscriptions.get(collectionId);
  if (subscription) {
    subscription.priority = priority;
  }
}

// Use useRef for per-user admin status caching
const adminCacheRef = useRef<{ [key: string]: { isAdmin: boolean; timestamp: number } }>({});

export function useMerchantCollections(options: {
  initialPriority?: number;
  deferLoad?: boolean;
  elementRef?: React.RefObject<HTMLDivElement>;
} = {}) {
  const { 
    initialPriority = SUBSCRIPTION_PRIORITY.LOW,
    deferLoad = false
  } = options;

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(!deferLoad);
  const [error, setError] = useState<string | null>(null);
  const [changingAccessId, setChangingAccessId] = useState<string | null>(null);
  
  const isFetchingRef = useRef(false);
  const cleanupFnsRef = useRef<Array<() => void>>([]);
  const isMountedRef = useRef(false);

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

  // Update last accessed time
  const updateAccessTime = useCallback(() => {
    const subscription = activeSubscriptions.get('merchant_collections');
    if (subscription) {
      activeSubscriptions.set('merchant_collections', {
        ...subscription,
        lastAccessed: Date.now()
      });
    }
  }, []);

  const fetchCollections = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    updateAccessTime();

    try {
      setError(null);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw authError || new Error('Not authenticated');
      }

      const isAdmin = await checkAdminStatus(user.id);
      
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

      // Transform and filter collections based on access
      const transformedCollections = data
        .filter(collection => {
          // Include collection if:
          // 1. User is the owner
          // 2. User has any access type (view/edit)
          // 3. User is an admin
          return collection.user_id === user.id || 
                 collection.access_type !== null ||
                 isAdmin;
        })
        .map(collection => ({
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
          categories: [],
          products: [],
          accessType: collection.access_type,
          isOwner: collection.user_id === user.id || isAdmin,
          owner_username: collection.owner_username
        } as Collection));

      if (isMountedRef.current) {
        setCollections(transformedCollections);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching collections:', err);
      const errorMessage = handleError(err);
      if (isMountedRef.current) {
        setError(errorMessage);
        toast.error(`Failed to load collections: ${errorMessage}`);
        setCollections([]);
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [checkAdminStatus, updateAccessTime]);

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
    isMountedRef.current = true;
    
    // Set initial priority
    subscriptionPriorities.set('merchant_collections', initialPriority);

    // Setup visibility tracking if element ref is provided
    if (options.elementRef?.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            const newPriority = entry.isIntersecting ? 
              SUBSCRIPTION_PRIORITY.HIGH : 
              SUBSCRIPTION_PRIORITY.LOW;
            updateSubscriptionPriority('merchant_collections', newPriority);
            
            // Fetch immediately if becoming visible and no data
            if (entry.isIntersecting && !collections && !loading) {
              fetchCollections();
            }
          });
        },
        { rootMargin: '100px' }
      );

      observer.observe(options.elementRef.current);
      return () => observer.disconnect();
    }

    // Initial fetch if not deferred or if high priority
    if (!deferLoad || initialPriority === SUBSCRIPTION_PRIORITY.HIGH) {
      fetchCollections();
    }

    // Setup realtime subscriptions with priority-based loading
    const setupSubscriptions = () => {
      // Check if we've exceeded subscription attempts
      const attempts = subscriptionAttempts.get('merchant_collections') || 0;
      if (attempts >= MAX_SUBSCRIPTION_ATTEMPTS) {
        console.log('Max subscription attempts reached for merchant collections');
        return;
      }
      subscriptionAttempts.set('merchant_collections', attempts + 1);

      // Clean up any existing subscriptions
      cleanupFnsRef.current.forEach(cleanup => cleanup());
      cleanupFnsRef.current = [];

      // Set up realtime subscription for both collections and collection_access
      const collectionsChannel = supabase.channel('collections_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'collections'
          },
          () => {
            updateAccessTime();
            fetchCollections();
          }
        )
        .subscribe((status) => {
          console.log('Collections subscription status:', status);
          if (status === 'CHANNEL_ERROR') {
            console.warn('Collections subscription error, will try to reconnect');
          }
        });

      const accessChannel = supabase.channel('access_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'collection_access'
          },
          () => {
            updateAccessTime();
            fetchCollections();
          }
        )
        .subscribe((status) => {
          console.log('Access subscription status:', status);
          if (status === 'CHANNEL_ERROR') {
            console.warn('Access subscription error, will try to reconnect');
          }
        });

      // Setup monitoring for connection issues
      const setupConnectionMonitoring = () => {
        let unhealthyCount = 0;
        const MAX_UNHEALTHY_COUNT = 3;
        
        // Check global health flag
        const checkHealth = () => {
          try {
            const isHealthy = isRealtimeConnectionHealthy();
            
            if (!isHealthy) {
              unhealthyCount++;
              console.log(`Connection check failed for merchant collections (${unhealthyCount}/${MAX_UNHEALTHY_COUNT})`);
              
              if (unhealthyCount >= MAX_UNHEALTHY_COUNT) {
                console.log('Connection consistently unhealthy for merchant collections');
                // For collections, we just refetch periodically instead of polling
                fetchCollections();
              }
            } else {
              unhealthyCount = 0;
            }
          } catch (err) {
            console.error('Error checking health:', err);
          }
        };
        
        // Initial check
        checkHealth();
        
        // Set up periodic check
        const healthCheckInterval = setInterval(checkHealth, 45000); // 45 seconds
        
        return () => clearInterval(healthCheckInterval);
      };

      const healthCheckCleanup = setupConnectionMonitoring();
      cleanupFnsRef.current.push(healthCheckCleanup);

      // Store cleanup function
      const cleanup = () => {
        console.log('Cleaning up merchant collections subscriptions');
        collectionsChannel.unsubscribe();
        accessChannel.unsubscribe();
        cleanupFnsRef.current.forEach(fn => fn());
        cleanupFnsRef.current = [];
        activeSubscriptions.delete('merchant_collections');
        subscriptionAttempts.delete('merchant_collections');
      };

      // Store in global subscription registry
      activeSubscriptions.set('merchant_collections', {
        cleanup,
        priority: initialPriority,
        lastAccessed: Date.now()
      });

      cleanupFnsRef.current.push(cleanup);
    };

    // Setup subscriptions if not deferred or if high priority
    if (!deferLoad || initialPriority === SUBSCRIPTION_PRIORITY.HIGH) {
      setupSubscriptions();
    }

    return () => {
      isMountedRef.current = false;
      // Clean up subscriptions
      cleanupFnsRef.current.forEach(fn => fn());
      cleanupFnsRef.current = [];
    };
  }, [fetchCollections, initialPriority, deferLoad, updateAccessTime, collections, loading]);

  return { 
    collections,
    loading,
    error,
    refetch: fetchCollections,
    changingAccessId,
    updateCollectionAccess
  };
}