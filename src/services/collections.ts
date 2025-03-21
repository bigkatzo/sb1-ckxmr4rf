import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

export async function fetchCollections(supabase: SupabaseClient<Database>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No user found');

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map((collection) => ({
    ...collection,
    isOwner: collection.user_id === user.id,
    accessType: collection.user_id === user.id ? 'edit' : 'view'
  }));
}

export * from './collections/index';