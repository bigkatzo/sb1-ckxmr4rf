import { supabase } from '../../lib/supabase';
import { parseFormDate } from '../../utils/date-helpers';
import { generateCollectionId, generateSlug } from '../../utils/id-helpers';
import { uploadCollectionImage } from './upload';
import { withTransaction } from '../../lib/database';
import type { CollectionData } from './types';

export async function createCollection(data: FormData) {
  return withTransaction(async () => {
    // Verify user authentication first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    // Handle image upload first if present
    const imageFile = data.get('image') as File;
    let imageUrl = '';
    
    if (imageFile) {
      try {
        imageUrl = await uploadCollectionImage(imageFile);
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        throw new Error('Failed to upload collection image. Please try again.');
      }
    }

    const launchDate = data.get('launchDate') as string;
    const parsedDate = parseFormDate(launchDate);
    const name = data.get('name') as string;
    const slug = data.get('slug') as string || generateSlug(name);
    const tags = JSON.parse(data.get('tags') as string || '[]');

    const collectionData: CollectionData = {
      id: generateCollectionId(),
      name,
      description: data.get('description') as string,
      image_url: imageUrl,
      launch_date: parsedDate.toISOString(),
      slug,
      visible: data.get('visible') === 'true',
      sale_ended: data.get('sale_ended') === 'true',
      tags,
      user_id: user.id
    };

    const { data: collection, error } = await supabase
      .from('collections')
      .insert(collectionData)
      .select()
      .single();

    if (error) throw error;
    if (!collection) throw new Error('Failed to create collection');

    return collection;
  });
}

export async function updateCollection(id: string, data: FormData) {
  return withTransaction(async () => {
    // Verify user authentication and ownership
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    // Verify collection exists and user owns it
    const { data: existingCollection, error: verifyError } = await supabase
      .from('collections')
      .select('image_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (verifyError || !existingCollection) {
      throw new Error('Collection not found or access denied');
    }

    // Handle image upload if present
    const imageFile = data.get('image') as File;
    let imageUrl = existingCollection.image_url;
    
    if (imageFile) {
      try {
        imageUrl = await uploadCollectionImage(imageFile);
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        throw new Error('Failed to upload collection image. Please try again.');
      }
    } else if (data.get('removeImage') === 'true') {
      imageUrl = null;
    }

    const updateData = {
      name: data.get('name') as string,
      description: data.get('description') as string,
      image_url: imageUrl,
      launch_date: parseFormDate(data.get('launchDate') as string).toISOString(),
      slug: data.get('slug') as string,
      visible: data.get('visible') === 'true',
      sale_ended: data.get('sale_ended') === 'true',
      tags: JSON.parse(data.get('tags') as string || '[]'),
      updated_at: new Date().toISOString()
    };

    const { data: collection, error } = await supabase
      .from('collections')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!collection) throw new Error('Collection not found');

    return collection;
  });
}

export async function toggleSaleEnded(id: string, saleEnded: boolean) {
  try {
    const { error } = await supabase
      .rpc('toggle_collection_sale_ended', {
        p_collection_id: id,
        p_sale_ended: saleEnded
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling sale ended status:', error);
    throw error instanceof Error ? error : new Error('Failed to toggle sale ended status');
  }
}

export async function toggleFeatured(id: string, featured: boolean) {
  return withTransaction(async () => {
    // Verify user authentication and ownership
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('collections')
      .update({ featured })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  });
}

export async function deleteCollection(id: string) {
  return withTransaction(async () => {
    // Verify user authentication and ownership
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    // Verify collection exists and user owns it
    const { data: collection, error: verifyError } = await supabase
      .from('collections')
      .select('id, image_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (verifyError || !collection) {
      throw new Error('Collection not found or access denied');
    }

    // Delete collection image if exists
    if (collection.image_url) {
      try {
        const path = collection.image_url.split('/').pop();
        if (path) {
          await supabase.storage
            .from('collection-images')
            .remove([path]);
        }
      } catch (cleanupError) {
        console.error('Failed to delete collection image:', cleanupError);
      }
    }

    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', id);

    if (error) throw error;
  });
}

export * from './types';
export * from './upload';