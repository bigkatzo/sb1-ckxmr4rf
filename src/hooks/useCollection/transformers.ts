import type { Category, Collection, Product } from '../../types';

export function transformCategory(category: any): Category | null {
  if (!category?.id) return null;
  
  return {
    id: category.id,
    name: category.name || '',
    description: category.description || '',
    type: category.type || 'blank',
    eligibilityRules: {
      rules: category.eligibility_rules?.rules || []
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
    categoryId: product.category_id || '',
    category: product.categories ? transformCategory(product.categories) : undefined,
    collectionId: collectionData.id,
    collectionName: collectionData.name || '',
    collectionSlug: collectionData.slug,
    slug: product.slug,
    stock: typeof product.quantity === 'number' ? product.quantity : 0,
    variants: Array.isArray(product.variants) ? product.variants : [],
    variantPrices: product.variant_prices || {},
    variantStock: product.variant_stock || {}
  };
}

export function transformCollection(data: any): Collection | null {
  if (!data?.id || !data?.slug) {
    console.warn('Invalid collection data:', data);
    return null;
  }

  const categories = (Array.isArray(data.categories) ? data.categories : [])
    .map(transformCategory)
    .filter(Boolean);

  const products = (Array.isArray(data.products) ? data.products : [])
    .map(product => transformProduct(product, data))
    .filter(Boolean);

  return {
    id: data.id,
    name: data.name || '',
    description: data.description || '',
    imageUrl: data.image_url || '',
    launchDate: new Date(data.launch_date || Date.now()),
    featured: Boolean(data.featured),
    visible: data.visible ?? true,
    slug: data.slug,
    categories,
    products
  };
}