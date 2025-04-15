import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductCard } from './ProductCard';
import { ProductGridSkeleton } from '../ui/Skeletons';
import { isValidProductNavigation } from '../../utils/validation';
import type { Product } from '../../types/variants';

interface ProductGridProps {
  products: Product[];
  categoryId?: string;
  categoryIndices: Record<string, number>;
  loading?: boolean;
}

export function ProductGrid({ products, categoryId, categoryIndices, loading }: ProductGridProps) {
  const navigate = useNavigate();
  
  const filteredProducts = useMemo(() => 
    categoryId 
      ? products.filter(product => product.categoryId === categoryId)
      : products,
    [products, categoryId]
  );

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

    // Get current scroll position
    const scrollPosition = window.scrollY;

    // Navigate to product page with product data, category index, and selected category ID
    navigate(`/${product.collectionSlug}/${product.slug}`, {
      state: { 
        product,
        categoryIndex: categoryIndices[product.categoryId] || 0,
        selectedCategoryId: categoryId,
        scrollPosition
      }
    });
  };

  if (loading) {
    return <ProductGridSkeleton />;
  }

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
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 sm:gap-3 md:gap-4">
      {filteredProducts.map((product, index) => {
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
        
        return (
          <ProductCard 
            key={product.id} 
            product={product} 
            onClick={() => handleProductClick(product)}
            categoryIndex={categoryIndices[product.categoryId] || 0}
            isInInitialViewport={index < initialViewportCount}
            loadingPriority={loadingPriority}
          />
        );
      })}
    </div>
  );
}