import { supabase } from '../lib/supabase';

export async function createCategory(data: FormData, collectionId: string) {
  try {
    const name = data.get('name');
    const description = data.get('description');
    const groups = JSON.parse(data.get('groups') as string || '[]');
    const visible = data.get('visible') === 'true';
    const saleEnded = data.get('saleEnded') === 'true';
    
    const categoryData = {
      collection_id: collectionId,
      name,
      description,
      type: groups.length > 0 ? 'rules-based' : 'blank',
      eligibility_rules: { groups },
      visible,
      sale_ended: saleEnded
    };

    const { data: category, error } = await supabase
      .from('categories')
      .insert(categoryData)
      .select('*, eligibility_rules')
      .single();

    if (error) throw error;
    return category;
  } catch (error) {
    console.error('Error creating category:', error);
    throw error;
  }
}

export async function updateCategory(id: string, data: FormData) {
  try {
    const groups = JSON.parse(data.get('groups') as string || '[]');
    const visible = data.get('visible') === 'true';
    const saleEnded = data.get('saleEnded') === 'true';
    
    const categoryData = {
      name: data.get('name'),
      description: data.get('description'),
      type: groups.length > 0 ? 'rules-based' : 'blank',
      eligibility_rules: { groups },
      visible,
      sale_ended: saleEnded
    };

    const { data: category, error } = await supabase
      .from('categories')
      .update(categoryData)
      .eq('id', id)
      .select('*, eligibility_rules')
      .single();

    if (error) throw error;
    return category;
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
}

export async function deleteCategory(id: string) {
  try {
    // First verify user has access to the category through the collection
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select(`
        id, 
        collection_id, 
        collections!inner (
          user_id
        )
      `)
      .eq('id', id)
      .single();

    if (categoryError || !category) {
      throw new Error('Category not found or access denied');
    }

    // Check if user is admin or owns the collection
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';
    
    // Extract user_id safely from the nested collections array
    const collectionUserId = category.collections && 
      Array.isArray(category.collections) && 
      category.collections.length > 0 &&
      category.collections[0].user_id;
    
    const isOwner = collectionUserId === user.id;

    // Check if user has edit access to the collection
    const { data: accessPermission } = await supabase
      .from('collection_access')
      .select('access_type')
      .eq('collection_id', category.collection_id)
      .eq('user_id', user.id)
      .single();
    
    const hasEditAccess = accessPermission?.access_type === 'edit';

    // Allow admin, owner, or users with edit access
    if (!isAdmin && !isOwner && !hasEditAccess) {
      throw new Error('Access denied');
    }

    // First check if the category has any products
    const { data: products, error: checkError } = await supabase
      .from('products')
      .select('id')
      .eq('category_id', id)
      .limit(1);

    if (checkError) throw checkError;

    // If products exist, don't allow deletion
    if (products && products.length > 0) {
      throw new Error('Cannot delete category with existing products. Please reassign or delete the products first.');
    }

    // If no products, proceed with deletion
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
}

export async function toggleSaleEnded(id: string, saleEnded: boolean) {
  try {
    // First verify user has access to the category through the collection
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select(`
        id, 
        collection_id, 
        collections!inner (
          user_id
        )
      `)
      .eq('id', id)
      .single();

    if (categoryError || !category) {
      throw new Error('Category not found or access denied');
    }

    // Check if user is admin or owns the collection
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';
    
    // Extract user_id safely from the nested collections array
    const collectionUserId = category.collections && 
      Array.isArray(category.collections) && 
      category.collections.length > 0 &&
      category.collections[0].user_id;
    
    const isOwner = collectionUserId === user.id;

    // Check if user has edit access to the collection
    const { data: accessPermission } = await supabase
      .from('collection_access')
      .select('access_type')
      .eq('collection_id', category.collection_id)
      .eq('user_id', user.id)
      .single();
    
    const hasEditAccess = accessPermission?.access_type === 'edit';

    // Allow admin, owner, or users with edit access
    if (!isAdmin && !isOwner && !hasEditAccess) {
      throw new Error('Access denied');
    }

    // Toggle sale ended status using direct update instead of RPC
    const { error } = await supabase
      .from('categories')
      .update({ sale_ended: saleEnded })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error toggling category sale ended status:', error);
    throw error;
  }
}

export async function toggleVisibility(id: string, visible: boolean) {
  try {
    // First verify user has access to the category through the collection
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select(`
        id, 
        collection_id, 
        collections!inner (
          user_id
        )
      `)
      .eq('id', id)
      .single();

    if (categoryError || !category) {
      throw new Error('Category not found or access denied');
    }

    // Check if user is admin or owns the collection
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';
    
    // Extract user_id safely from the nested collections array
    const collectionUserId = category.collections && 
      Array.isArray(category.collections) && 
      category.collections.length > 0 &&
      category.collections[0].user_id;
    
    const isOwner = collectionUserId === user.id;

    // Check if user has edit access to the collection
    const { data: accessPermission } = await supabase
      .from('collection_access')
      .select('access_type')
      .eq('collection_id', category.collection_id)
      .eq('user_id', user.id)
      .single();
    
    const hasEditAccess = accessPermission?.access_type === 'edit';

    // Allow admin, owner, or users with edit access
    if (!isAdmin && !isOwner && !hasEditAccess) {
      throw new Error('Access denied');
    }

    // Toggle visibility
    const { error } = await supabase
      .from('categories')
      .update({ visible })
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error toggling category visibility:', error);
    throw error;
  }
}