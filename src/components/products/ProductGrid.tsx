import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductCard } from './ProductCard';
import { isValidProductNavigation } from '../../utils/validation';
import type { Product } from '../../types';

interface ProductGridProps {
  products: Product[];
  categoryId?: string;
  categoryIndices: Record<string, number>;
}

export function ProductGrid({ products, categoryId, categoryIndices }: ProductGridProps) {
  const navigate = useNavigate();
  
  const filteredProducts = React.useMemo(() => 
    categoryId 
      ? products.filter(product => product.categoryId === categoryId)
      : products,
    [products, categoryId]
  );

  const handleProductClick = (product: Product) => {
    if (!isValidProductNavigation(product)) {
      console.error('Invalid product data for navigation:', {
        id: product.id,
        sku: product.sku,
        name: product.name,
        collectionSlug: product.collectionSlug,
        slug: product.slug
      });
      return;
    }

    navigate(`/${product.collectionSlug}/${product.slug}`, {
      state: { 
        product,
        categoryIndex: categoryIndices[product.categoryId] || 0
      }
    });
  };

  if (!Array.isArray(filteredProducts) || filteredProducts.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-900 rounded-xl">
        <p className="text-gray-400">
          {categoryId 
            ? 'No products available in this category.'
            : 'No products available in this collection.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 sm:gap-6">
      {filteredProducts.map((product) => (
        <ProductCard 
          key={product.id} 
          product={product} 
          onClick={() => handleProductClick(product)}
          categoryIndex={categoryIndices[product.categoryId] || 0}
        />
      ))}
    </div>
  );
}