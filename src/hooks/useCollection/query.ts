import { supabase } from '../../lib/supabase';

export function getCollectionQuery(slug: string, includeHidden: boolean = false) {
  let query = supabase
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
      custom_url,
      x_url,
      telegram_url,
      dexscreener_url,
      pumpfun_url,
      website_url,
      free_notes,
      ca,
      strict_token,
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
        eligibility_rules,
        visible
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
        visible,
        categories:category_id (
          id,
          name,
          description,
          type,
          eligibility_rules,
          visible
        )
      )
    `)
    .eq('slug', slug);
  
  // Only filter by visibility if not in preview mode
  if (!includeHidden) {
    query = query.eq('visible', true);
  }
  
  return query.single();
}