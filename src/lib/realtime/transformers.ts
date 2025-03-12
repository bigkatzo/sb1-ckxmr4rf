import type { Collection, Category, Product } from '../../types/index';
import type { ProductVariant } from '../../types/variants';
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
    eligibilityRules: {
      groups: dbProduct.categories.eligibility_rules?.groups || []
    }
  } : undefined;

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
    visible: dbProduct.visible ?? true
  };
}