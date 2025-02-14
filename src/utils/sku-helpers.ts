import { supabase } from '../lib/supabase';

/**
 * Validates a SKU format
 * Valid format: PRD followed by 6 digits (e.g., PRD123456)
 */
export function isValidSku(sku: string): boolean {
  return /^PRD\d{6}$/.test(sku);
}

/**
 * Fetches a product by SKU
 */
export async function getProductBySku(sku: string) {
  if (!isValidSku(sku)) {
    throw new Error('Invalid SKU format');
  }

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories:category_id (*),
      collections:collection_id (
        id,
        name,
        slug
      )
    `)
    .eq('sku', sku)
    .single();

  if (error) throw error;
  return data;
}