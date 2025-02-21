import { supabase } from '../lib/supabase';

export async function inspectTableSchema(tableName: string) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching schema:', error);
    return;
  }

  console.log(`Schema for ${tableName}:`, data);
}

// Usage example
inspectTableSchema('user_profiles'); 