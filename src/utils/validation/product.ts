import type { Product } from '../../types';

export function isValidProductNavigation(product: Product): boolean {
  return Boolean(
    product &&
    typeof product.id === 'string' &&
    typeof product.sku === 'string' &&
    typeof product.name === 'string' &&
    typeof product.collectionSlug === 'string' &&
    typeof product.slug === 'string' &&
    product.collectionSlug.length > 0 &&
    product.slug.length > 0
  );
}