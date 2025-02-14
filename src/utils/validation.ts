import type { Product } from '../types';

export function isValidCollectionSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && 
         slug !== 'undefined' && 
         slug.length > 0 && 
         /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function isValidUUID(str: unknown): boolean {
  if (typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function isValidProductNavigation(product: Product): boolean {
  return Boolean(
    product &&
    product.collectionSlug &&
    product.slug &&
    typeof product.collectionSlug === 'string' &&
    typeof product.slug === 'string'
  );
}