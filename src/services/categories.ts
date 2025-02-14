import { supabase } from '../lib/supabase';

interface CategoryData {
  name: string;
  description: string;
  type: 'blank' | 'whitelist' | 'rules-based';
  eligibility_rules: {
    rules: Array<{
      type: string;
      value: string;
      quantity?: number;
    }>;
  };
}

export async function createCategory(data: FormData, collectionId: string) {
  try {
    const rules = JSON.parse(data.get('rules') as string || '[]');
    
    const categoryData = {
      collection_id: collectionId,
      name: data.get('name'),
      description: data.get('description'),
      type: rules.length > 0 ? 'rules-based' : 'blank',
      eligibility_rules: { rules }
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
    const rules = JSON.parse(data.get('rules') as string || '[]');
    
    const categoryData = {
      name: data.get('name'),
      description: data.get('description'),
      type: rules.length > 0 ? 'rules-based' : 'blank',
      eligibility_rules: { rules }
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