import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductCard } from './ProductCard';
import { ProductGridSkeleton } from '../ui/Skeletons';
import { isValidProductNavigation } from '../../utils/validation';
import { smoothScrollOnNewContent } from '../../utils/scrollUtils';
import type { Product } from '../../types/variants';

interface ProductGridProps {
  products: Product[];
  categoryId?: string;
  categoryIndices: Record<string, number>;
  loading?: boolean;
  onProductClick?: (product: Product, scrollPosition: number) => void;
  loadingMore?: boolean;
}

export function ProductGrid({ 
  products, 
  categoryId, 
  categoryIndices, 
  loading,
  onProductClick,
  loadingMore
}: ProductGridProps) {
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement>(null);
  const prevProductsLength = useRef<number>(0);
  
  const filteredProducts = useMemo(() => 
    categoryId 
      ? products.filter(product => product.categoryId === categoryId)
      : products,
    [products, categoryId]
  );

  // Effect for handling smooth scrolling when new products are loaded
  useEffect(() => {
    if (prevProductsLength.current < filteredProducts.length && !loading) {
      // Smooth scroll when new products are loaded
      smoothScrollOnNewContent(gridRef.current);
      prevProductsLength.current = filteredProducts.length;
    }
  }, [filteredProducts.length, loading]);

  // Create placeholders for products that are loading
  const generatePlaceholders = () => {
    // Only add placeholders if we're loading more and have some products already
    if (!loadingMore || filteredProducts.length === 0) return [];
    
    // Add 4-8 placeholders depending on screen size
    const placeholderCount = window.innerWidth >= 768 ? 8 : 4;
    
    return Array(placeholderCount).fill(null).map((_, i) => ({
      id: `placeholder-${i}`,
      isPlaceholder: true
    }));
  };

  // Calculate how many products are visible in the initial viewport based on screen size
  const getInitialViewportCount = () => {
    // Get viewport width
    const width = window.innerWidth;
    // Get viewport height minus header (16rem for pt-16 in main)
    const height = window.innerHeight - 256; // 16rem = 256px

    // Calculate grid columns based on breakpoints (matching Tailwind classes)
    let columns = 2; // Default mobile
    if (width >= 768) columns = 4; // md:grid-cols-4
    else if (width >= 640) columns = 3; // sm:grid-cols-3

    // Calculate row height (1:1 aspect ratio + gap + padding)
    const rowHeight = (width / columns) + 24; // 24px for gap and padding

    // Calculate number of rows that fit in viewport
    const rows = Math.ceil(height / rowHeight);

    // Return total number of products visible
    return rows * columns;
  };

  const initialViewportCount = useMemo(() => getInitialViewportCount(), []);
  
  // Combine actual products with placeholders
  const displayProducts = useMemo(() => {
    const placeholders = generatePlaceholders();
    return [...filteredProducts, ...placeholders];
  }, [filteredProducts, loadingMore]);

  const handleProductClick = (product: Product) => {
    // Don't process clicks on placeholders
    if ((product as any).isPlaceholder) return;
    
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

    // Get current scroll position
    const scrollPosition = window.scrollY;
    
    // Call the external handler if provided
    if (onProductClick) {
      onProductClick(product, scrollPosition);
    }

    // Navigate to product page with product data, category index, and selected category ID
    navigate(`/${product.collectionSlug}/${product.slug}`, {
      state: { 
        product,
        categoryIndex: categoryIndices[product.categoryId] || 0,
        selectedCategoryId: categoryId,
        scrollPosition,
        returnedFromProduct: true,
        // Preserve preview mode in state
        preservePreview: window.location.search.includes('preview')
      }
    });
  };

  if (loading && filteredProducts.length === 0) {
    return <ProductGridSkeleton />;
  }

  if (!loading && (!Array.isArray(filteredProducts) || filteredProducts.length === 0)) {
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
    <div 
      ref={gridRef}
      className={`grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 sm:gap-3 md:gap-4 product-grid-container ${loadingMore ? 'staggered-fade-in' : ''}`}
      style={{ 
        minHeight: filteredProducts.length > 0 ? '200px' : 'auto', 
        contain: 'content' 
      }}
    >
      {displayProducts.map((product, index) => {
        // Calculate row and column position for consistent loading order
        let columns = 2; // Default mobile
        if (window.innerWidth >= 768) columns = 4; // md:grid-cols-4
        else if (window.innerWidth >= 640) columns = 3; // sm:grid-cols-3
        
        // Calculate row and column based on index
        const row = Math.floor(index / columns);
        const col = index % columns;
        
        // Set loading priority based on visual position (top-to-bottom, left-to-right)
        // Lower priority value means higher loading priority
        const loadingPriority = row * 100 + col;
        
        // For placeholders, render a skeleton card
        if ((product as any).isPlaceholder) {
          return (
            <div 
              key={`placeholder-${index}`}
              className="product-placeholder animate-pulse bg-gray-800 rounded-xl aspect-square"
            />
          );
        }
        
        return (
          <ProductCard 
            key={product.id} 
            product={product as Product} 
            onClick={() => handleProductClick(product as Product)}
            categoryIndex={categoryIndices[(product as Product).categoryId] || 0}
            isInInitialViewport={index < initialViewportCount}
            loadingPriority={loadingPriority}
          />
        );
      })}
    </div>
  );
}