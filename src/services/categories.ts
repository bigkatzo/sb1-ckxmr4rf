import { supabase } from '../lib/supabase';

export async function createCategory(data: FormData, collectionId: string) {
  try {
    const name = data.get('name');
    const description = data.get('description');
    const groups = JSON.parse(data.get('groups') as string || '[]');
    const visible = data.get('visible') === 'true';
    const acceptedTokens = JSON.parse(data.get('acceptedTokens') as string || '["SOL"]');
    
    const categoryData = {
      collection_id: collectionId,
      name,
      description,
      type: groups.length > 0 ? 'rules-based' : 'blank',
      eligibility_rules: { groups },
      visible,
      accepted_tokens: acceptedTokens
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
    const acceptedTokens = JSON.parse(data.get('acceptedTokens') as string || '["SOL"]');
    
    const categoryData = {
      name: data.get('name'),
      description: data.get('description'),
      type: groups.length > 0 ? 'rules-based' : 'blank',
      eligibility_rules: { groups },
      visible,
      accepted_tokens: acceptedTokens
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