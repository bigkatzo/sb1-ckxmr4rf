import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export function subscribeToCollection(
  collectionId: string,
  onUpdate: () => void
): RealtimeChannel {
  return supabase
    .channel(`collection:${collectionId}`)
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'collections', 
        filter: `id=eq.${collectionId}` 
      },
      () => {
        console.log('Collection updated:', collectionId);
        onUpdate();
      }
    )
    .subscribe();
}

export function subscribeToCollectionProducts(
  collectionId: string,
  onUpdate: () => void
): RealtimeChannel {
  return supabase
    .channel(`collection_products:${collectionId}`)
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'products', 
        filter: `collection_id=eq.${collectionId}` 
      },
      () => {
        console.log('Collection products updated:', collectionId);
        onUpdate();
      }
    )
    .subscribe();
}

export function subscribeToCollectionCategories(
  collectionId: string,
  onUpdate: () => void
): RealtimeChannel {
  return supabase
    .channel(`collection_categories:${collectionId}`)
    .on(
      'postgres_changes',
      { 
        event: '*', 
        schema: 'public', 
        table: 'categories', 
        filter: `collection_id=eq.${collectionId}` 
      },
      () => {
        console.log('Collection categories updated:', collectionId);
        onUpdate();
      }
    )
    .subscribe();
}