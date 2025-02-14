import type { Category, Product } from '../types';

/**
 * Creates a mapping of category IDs to their indices based on category order
 */
export function createCategoryIndices(categories: Category[]): Record<string, number> {
  return categories.reduce((acc, category, index) => {
    acc[category.id] = index;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Creates a mapping of category IDs to their indices based on products' categories
 */
export function createCategoryIndicesFromProducts(products: Product[]): Record<string, number> {
  // Get unique categories from products
  const uniqueCategories = Array.from(new Set(
    products
      .filter(p => p.category)
      .map(p => p.category!)
  ));

  // Sort categories to ensure consistent ordering
  const sortedCategories = uniqueCategories.sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  return createCategoryIndices(sortedCategories);
}