import { supabase } from '../../lib/supabase';
import { parseFormDate } from '../../utils/date-helpers';
import { generateCollectionId, generateSlug } from '../../utils/id-helpers';
import { uploadCollectionImage } from './upload';
import { withTransaction } from '../../lib/database';

export async function createCollection(data: FormData) {
  return withTransaction(async () => {
    try {
      // Get user if available, but don't require authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(`Authentication error: ${authError.message}`);
      if (!user) throw new Error('You must be logged in to create a collection');

      // Get and validate required fields
      const name = data.get('name');
      if (!name) throw new Error('Collection name is required');

      // Get launch date and ensure it's valid
      const launchDate = data.get('launchDate');
      if (!launchDate) throw new Error('Launch date is required');
      const parsedDate = parseFormDate(launchDate as string);
      if (!parsedDate) throw new Error('Invalid launch date format');

      // Generate or get slug
      const slug = data.get('slug') as string || generateSlug(name as string);
      if (!slug) throw new Error('Invalid collection ID');

      // Handle image upload first if present
      const imageFile = data.get('image') as File;
      let imageUrl = '';
      
      if (imageFile && imageFile instanceof File) {
        try {
          imageUrl = await uploadCollectionImage(imageFile);
        } catch (uploadError) {
          throw new Error('Failed to upload collection image. Please try again.');
        }
      }

      // Parse tags with fallback
      let tags = [];
      try {
        const tagsStr = data.get('tags');
        if (tagsStr) {
          tags = JSON.parse(tagsStr as string);
        }
      } catch (e) {
        throw new Error('Invalid tags format');
      }

      const collectionData = {
        id: generateCollectionId(),
        name: name as string,
        description: data.get('description') as string || '',
        image_url: imageUrl || null,
        launch_date: parsedDate.toISOString(),
        slug,
        visible: data.get('visible') === 'true',
        sale_ended: data.get('sale_ended') === 'true',
        tags,
        user_id: user.id
      };

      // First, verify the table structure
      const { error: describeError } = await supabase
        .from('collections')
        .select('id')
        .limit(1);

      if (describeError) {
        throw new Error(`Database schema error: ${describeError.message}`);
      }

      const { data: collection, error: insertError } = await supabase
        .from('collections')
        .insert(collectionData)
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') { // Unique violation
          throw new Error('A collection with this ID already exists. Please try a different one.');
        }
        throw new Error(`Failed to create collection: ${insertError.message}`);
      }
      
      if (!collection) throw new Error('Failed to create collection: No data returned');

      return collection;
    } catch (error) {
      throw error instanceof Error ? error : new Error('An unexpected error occurred while creating the collection');
    }
  });
}

export async function updateCollection(id: string, data: FormData) {
  return withTransaction(async () => {
    // Verify user authentication and ownership
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    // First check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';

    // Verify collection exists and user has proper access
    const { data: existingCollection, error: verifyError } = await supabase
      .from('collections')
      .select('image_url')
      .eq('id', id)
      .single();

    if (verifyError || !existingCollection) {
      throw new Error('Collection not found or access denied');
    }

    // If not admin, verify ownership
    if (!isAdmin) {
      const { data: ownerCheck, error: ownerError } = await supabase
        .from('collections')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (ownerError || !ownerCheck) {
        throw new Error('Collection not found or access denied');
      }
    }

    // Handle image upload if present
    const imageFile = data.get('image') as File;
    let imageUrl = existingCollection.image_url;
    
    if (imageFile) {
      try {
        imageUrl = await uploadCollectionImage(imageFile);
      } catch (uploadError) {
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
  return withTransaction(async () => {
    // Verify user authentication and ownership
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    // First check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';

    // If not admin, verify ownership
    if (!isAdmin) {
      const { data: ownerCheck, error: ownerError } = await supabase
        .from('collections')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (ownerError || !ownerCheck) {
        throw new Error('Collection not found or access denied');
      }
    }

    const { error } = await supabase
      .rpc('toggle_collection_sale_ended', {
        p_collection_id: id,
        p_sale_ended: saleEnded
      });

    if (error) throw error;
  });
}

export async function toggleFeatured(id: string, featured: boolean) {
  return withTransaction(async () => {
    // Verify user authentication and ownership
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    // First check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';

    // If not admin, verify ownership
    if (!isAdmin) {
      const { data: ownerCheck, error: ownerError } = await supabase
        .from('collections')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (ownerError || !ownerCheck) {
        throw new Error('Collection not found or access denied');
      }
    }

    const { error } = await supabase
      .from('collections')
      .update({ featured })
      .eq('id', id);

    if (error) throw error;
  });
}

export async function deleteCollection(id: string) {
  return withTransaction(async () => {
    // Verify user authentication and ownership
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    // First check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';

    // Verify collection exists and user has proper access
    const { data: collection, error: verifyError } = await supabase
      .from('collections')
      .select('id, image_url')
      .eq('id', id)
      .single();

    if (verifyError || !collection) {
      throw new Error('Collection not found or access denied');
    }

    // If not admin, verify ownership
    if (!isAdmin) {
      const { data: ownerCheck, error: ownerError } = await supabase
        .from('collections')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (ownerError || !ownerCheck) {
        throw new Error('Collection not found or access denied');
      }
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
        // Keep this error log as it's important for debugging file cleanup issues
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
export * from './upload';
export * from './upload';