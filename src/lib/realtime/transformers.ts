import type { Collection, Category } from '../../types/index';
import type { Product, ProductVariant } from '../../types/variants';
import { normalizeStorageUrl } from '../storage';

export function transformCollection(dbCollection: any): Collection {
  return {
    id: dbCollection.id,
    name: dbCollection.name,
    description: dbCollection.description,
    imageUrl: dbCollection.image_url ? normalizeStorageUrl(dbCollection.image_url) : '',
    launchDate: new Date(dbCollection.launch_date),
    featured: dbCollection.featured || false,
    visible: dbCollection.visible ?? true,
    saleEnded: dbCollection.sale_ended || false,
    accessType: dbCollection.access_type ?? null,
    slug: dbCollection.slug || '',
    categories: [],
    products: []
  };
}

export function transformProduct(dbProduct: any): Product {
  // Debug: Log the raw product data with exact values and types
  console.log('Raw product data from DB (transformers.ts):', {
    notes: dbProduct.notes,
    free_notes: dbProduct.free_notes,
    notes_type: typeof dbProduct.notes,
    free_notes_type: typeof dbProduct.free_notes, 
    notes_json: JSON.stringify(dbProduct.notes),
    all_keys: Object.keys(dbProduct)
  });
  
  const variants: ProductVariant[] = dbProduct.variants || [];
  const category: Category | undefined = dbProduct.categories ? {
    id: dbProduct.categories.id,
    name: dbProduct.categories.name,
    description: dbProduct.categories.description,
    type: dbProduct.categories.type,
    visible: dbProduct.categories.visible ?? true,
    eligibilityRules: {
      groups: dbProduct.categories.eligibility_rules?.groups || []
    }
  } : undefined;

  // Fix for empty string objects in JSONB columns
  const hasValidNotes = dbProduct.notes && typeof dbProduct.notes === 'object' && Object.keys(dbProduct.notes).length > 0;
  
  return {
    id: dbProduct.id,
    sku: dbProduct.sku,
    name: dbProduct.name,
    description: dbProduct.description,
    price: dbProduct.price,
    imageUrl: dbProduct.images?.[0] ? normalizeStorageUrl(dbProduct.images[0]) : '',
    images: (dbProduct.images || []).map((img: string) => normalizeStorageUrl(img)),
    categoryId: dbProduct.category_id,
    category,
    collectionId: dbProduct.collection_id,
    collectionName: dbProduct.collections?.name,
    collectionSlug: dbProduct.collections?.slug,
    slug: dbProduct.slug || '',
    stock: dbProduct.quantity,
    minimumOrderQuantity: dbProduct.minimum_order_quantity || 50,
    variants,
    variantPrices: dbProduct.variant_prices || {},
    priceModifierBeforeMin: dbProduct.price_modifier_before_min ?? null,
    priceModifierAfterMin: dbProduct.price_modifier_after_min ?? null,
    visible: dbProduct.visible ?? true,
    notes: hasValidNotes ? dbProduct.notes : undefined,
    freeNotes: dbProduct.free_notes || ''
  };
}