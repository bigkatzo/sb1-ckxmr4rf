import { supabase } from '../../lib/supabase';

export function getCollectionQuery(slug: string) {
  return supabase
    .from('collections')
    .select(`
      id,
      name,
      description,
      image_url,
      launch_date,
      featured,
      visible,
      slug,
      theme_primary_color,
      theme_secondary_color,
      theme_background_color,
      theme_text_color,
      theme_use_custom,
      theme_use_classic,
      theme_logo_url,
      categories (
        id,
        name,
        description,
        type,
        eligibility_rules
      ),
      products (
        id,
        sku,
        name,
        description,
        price,
        images,
        quantity,
        category_id,
        variants,
        variant_prices,
        slug,
        categories:category_id (
          id,
          name,
          description,
          type,
          eligibility_rules
        )
      )
    `)
    .eq('slug', slug)
    .eq('visible', true)
    .single();
}