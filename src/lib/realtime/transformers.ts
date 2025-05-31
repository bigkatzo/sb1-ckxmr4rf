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
  const variants: ProductVariant[] = dbProduct.variants || [];
  const category: Category | undefined = dbProduct.categories ? {
    id: dbProduct.categories.id,
    name: dbProduct.categories.name,
    description: dbProduct.categories.description,
    type: dbProduct.categories.type,
    visible: dbProduct.categories.visible ?? true,
    saleEnded: dbProduct.categories.sale_ended ?? false,
    eligibilityRules: {
      groups: dbProduct.categories.eligibility_rules?.groups || []
    }
  } : undefined;

  // Fix for empty string objects in JSONB columns
  const hasValidNotes = dbProduct.notes && typeof dbProduct.notes === 'object' && Object.keys(dbProduct.notes).length > 0;
  
  // CRITICAL FIX: Direct assignment from free_notes column
  const freeNotesValue = dbProduct.free_notes || '';
  
  return {
    id: dbProduct.id,
    sku: dbProduct.sku,
    name: dbProduct.name,
    description: dbProduct.description,
    price: dbProduct.price,
    imageUrl: dbProduct.images?.[0] ? normalizeStorageUrl(dbProduct.images[0]) : '',
    images: (dbProduct.images || []).map((img: string) => normalizeStorageUrl(img)),
    designFiles: (dbProduct.design_files || []).map((file: string) => normalizeStorageUrl(file)),
    categoryId: dbProduct.category_id,
    category,
    collectionId: dbProduct.collection_id,
    collectionName: dbProduct.collections?.name,
    collectionSlug: dbProduct.collections?.slug,
    collectionLaunchDate: dbProduct.collections?.launch_date ? new Date(dbProduct.collections.launch_date) : undefined,
    collectionSaleEnded: dbProduct.collections?.sale_ended ?? false,
    categorySaleEnded: dbProduct.categories?.sale_ended ?? false,
    slug: dbProduct.slug || '',
    stock: dbProduct.quantity,
    minimumOrderQuantity: dbProduct.minimum_order_quantity || 50,
    variants,
    variantPrices: dbProduct.variant_prices || {},
    priceModifierBeforeMin: dbProduct.price_modifier_before_min ?? null,
    priceModifierAfterMin: dbProduct.price_modifier_after_min ?? null,
    pinOrder: dbProduct.pin_order ?? null,
    blankCode: dbProduct.blank_code || '',
    technique: dbProduct.technique || '',
    noteForSupplier: dbProduct.note_for_supplier || '',
    visible: dbProduct.visible ?? true,
    saleEnded: dbProduct.sale_ended ?? false,
    notes: hasValidNotes ? dbProduct.notes : undefined,
    freeNotes: freeNotesValue
  };
}