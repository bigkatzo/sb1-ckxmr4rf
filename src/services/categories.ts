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
    // Validate required fields
    const name = data.get('name');
    const description = data.get('description');
    
    if (!name || !description) {
      throw new Error('Name and description are required');
    }

    if (!collectionId) {
      throw new Error('Collection ID is required');
    }

    let rules;
    try {
      const rulesStr = data.get('rules');
      console.log('Raw rules data:', rulesStr);
      rules = JSON.parse(rulesStr as string || '[]');
      
      // Validate rules structure
      if (rules.length > 0) {
        const validRules = rules.every((rule: any) => 
          rule.type && 
          rule.value && 
          (rule.type !== 'token' || (typeof rule.quantity === 'number' && rule.quantity > 0))
        );
        
        if (!validRules) {
          throw new Error('Invalid rules format - each rule must have type and value');
        }
      }
    } catch (e) {
      console.error('Failed to parse rules:', e);
      throw new Error('Invalid rules format');
    }
    
    const categoryData = {
      collection_id: collectionId,
      name,
      description,
      type: rules.length > 0 ? 'rules-based' : 'blank',
      eligibility_rules: { rules }
    };

    console.log('Creating category with data:', JSON.stringify(categoryData, null, 2));

    const { data: category, error } = await supabase
      .from('categories')
      .insert(categoryData)
      .select('*, eligibility_rules')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(error.message);
    }
    
    if (!category) {
      throw new Error('Failed to create category - no data returned');
    }

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