import { supabase } from '../lib/supabase';
import type { Category } from '../types/categories';

function getFormValue(data: FormData, key: string): string | null {
  const value = data.get(key);
  return value instanceof File ? null : value;
}

export async function createCategory(collectionId: string, data: FormData): Promise<Category | null> {
  try {
    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        collection_id: collectionId,
        name: getFormValue(data, 'name'),
        description: getFormValue(data, 'description'),
        type: getFormValue(data, 'type'),
        visible: getFormValue(data, 'visible') === 'true',
        order: parseInt(getFormValue(data, 'order') || '0', 10)
      })
      .select()
      .single();

    if (error) throw error;
    return category;
  } catch (error) {
    console.error('Error creating category:', error);
    throw error;
  }
}

export async function updateCategory(id: string, data: FormData): Promise<Category | null> {
  try {
    const updates: Record<string, any> = {};
    
    // Only include fields that are present in the FormData
    for (const [key, value] of data.entries()) {
      if (value instanceof File) continue;
      
      if (key === 'visible') {
        updates[key] = value === 'true';
      } else if (key === 'order') {
        updates[key] = parseInt(value, 10);
      } else {
        updates[key] = value;
      }
    }

    const { data: category, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return category;
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
}

export async function deleteCategory(id: string): Promise<void> {
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