import type { Category, Collection, DatabaseCollection, Product } from '../../types/index';

export function transformCategory(category: any): Category | undefined {
  if (!category?.id) return undefined;
  
  return {
    id: category.id,
    name: category.name || '',
    description: category.description || '',
    type: category.type || 'blank',
    visible: category.visible ?? true,
    saleEnded: category.sale_ended ?? false,
    eligibilityRules: {
      groups: category.eligibility_rules?.groups || []
    }
  };
}

export function transformProduct(product: any, collectionData: any): Product | null {
  if (!product?.id || !collectionData?.id || !product.slug || !collectionData.slug) {
    console.warn('Invalid product data:', { product, collectionData });
    return null;
  }

  return {
    id: product.id,
    sku: product.sku || '',
    name: product.name || '',
    description: product.description || '',
    price: Number(product.price) || 0,
    imageUrl: product.images?.[0] || '',
    images: Array.isArray(product.images) ? product.images : [],
    designFiles: Array.isArray(product.design_files) ? product.design_files : [],
    categoryId: product.category_id || '',
    category: product.categories ? transformCategory(product.categories) : undefined,
    collectionId: collectionData.id,
    collectionName: collectionData.name || '',
    collectionSlug: collectionData.slug,
    collectionCa: collectionData.ca || '',
    collectionStrictToken: collectionData.strict_token || '',
    slug: product.slug,
    stock: product.quantity,
    minimumOrderQuantity: product.minimum_order_quantity || 50,
    variants: product.variants || [],
    variantPrices: product.variant_prices || {},
    priceModifierBeforeMin: product.price_modifier_before_min ?? null,
    priceModifierAfterMin: product.price_modifier_after_min ?? null,
    pinOrder: product.pin_order ?? null,
    blankCode: product.blank_code || '',
    technique: product.technique || '',
    noteForSupplier: product.note_for_supplier || '',
    visible: product.visible ?? true,
    saleEnded: product.sale_ended ?? false,
    notes: product.notes || {},
    freeNotes: product.free_notes || '',
  };
}

export function transformCollection(data: Partial<DatabaseCollection>): Collection | null {
  if (!data?.id || !data?.slug) {
    console.warn('Invalid collection data:', data);
    return null;
  }

  const categories = (Array.isArray(data.categories) ? data.categories : [])
    .map(transformCategory)
    .filter((cat: Category | undefined): cat is Category => cat !== undefined);

  const products = (Array.isArray(data.products) ? data.products : [])
    .map((product: any) => transformProduct(product, data))
    .filter((product: Product | null): product is Product => product !== null);

  // Log theme data for debugging
  console.log('Collection theme data:', {
    theme_use_custom: data.theme_use_custom,
    theme_primary_color: data.theme_primary_color,
    theme_secondary_color: data.theme_secondary_color,
    theme_background_color: data.theme_background_color,
    theme_text_color: data.theme_text_color,
    theme_use_classic: data.theme_use_classic,
    theme_logo_url: data.theme_logo_url
  });

  // Ensure launch date is properly handled as UTC
  const launchDate = data.launch_date
    ? new Date(data.launch_date) // Database provides proper UTC string
    : new Date();

  // Handle access type conversion
  let accessType: Collection['accessType'] = null;
  if (data.is_owner) {
    accessType = 'owner';
  } else if (data.access_type === 'admin') {
    accessType = 'owner'; // Map admin to owner for frontend
  } else if (data.access_type === 'view' || data.access_type === 'edit') {
    accessType = data.access_type;
  }

  // Create the collection object with explicit type
  const collection: Collection = {
    id: data.id,
    name: data.name || '',
    description: data.description || '',
    imageUrl: data.image_url || '',
    launchDate,
    featured: Boolean(data.featured),
    visible: data.visible ?? true,
    saleEnded: data.sale_ended ?? false,
    slug: data.slug,
    user_id: data.user_id || '',
    custom_url: data.custom_url || '',
    x_url: data.x_url || '',
    telegram_url: data.telegram_url || '',
    dexscreener_url: data.dexscreener_url || '',
    ca: data.ca || '',
    strict_token: data.strict_token || '',
    pumpfun_url: data.pumpfun_url || '',
    website_url: data.website_url || '',
    free_notes: data.free_notes || '',
    categories,
    products,
    accessType,
    isOwner: data.is_owner ?? false,
    owner_username: data.owner_username || null,
    collection_access: data.collection_access || [],
    // Theme data
    theme_primary_color: data.theme_primary_color || null,
    theme_secondary_color: data.theme_secondary_color || null,
    theme_background_color: data.theme_background_color || null,
    theme_text_color: data.theme_text_color || null,
    theme_use_custom: data.theme_use_custom ?? false,
    theme_use_classic: data.theme_use_classic ?? true,
    theme_logo_url: data.theme_logo_url || null
  };

  return collection;
}