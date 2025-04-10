import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCardCompact } from './ProductCardCompact';
import { ProductModal } from './ProductModal';
import { useBestSellers } from '../../hooks/useBestSellers';
import { BestSellersSkeleton } from '../ui/Skeletons';
import type { Product as VariantsProduct } from '../../types/variants';

export function BestSellers() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { products: rawProducts, categoryIndices, loading } = useBestSellers(10);
  const [selectedProduct, setSelectedProduct] = useState<VariantsProduct | null>(null);
  const [visibleItemCount, setVisibleItemCount] = useState(3); // Default to mobile

  // Ensure products have all required properties for VariantsProduct
  const products = rawProducts.map(product => ({
    ...product,
    visible: product.visible === undefined ? true : product.visible // Ensure visible is defined
  })) as unknown as VariantsProduct[];

  // Update visible items count based on screen size
  useEffect(() => {
    // Initialize on mount
    updateVisibleItemCount();
    
    // Update on resize
    window.addEventListener('resize', updateVisibleItemCount);
    return () => window.removeEventListener('resize', updateVisibleItemCount);
  }, []);

  // Determine how many items are visible in the carousel based on screen width
  const updateVisibleItemCount = () => {
    const width = window.innerWidth;
    // For mobile (< 640px): show 3 items
    // For tablets (640px - 1024px): show 4 items
    // For desktop (> 1024px): show 6 items
    if (width < 640) {
      setVisibleItemCount(3);
    } else if (width < 1024) {
      setVisibleItemCount(4);
    } else {
      setVisibleItemCount(6);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.clientWidth;
    const scrollAmount = direction === 'left' ? -(containerWidth * 0.8) : containerWidth * 0.8;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  if (loading) {
    return <BestSellersSkeleton />;
  }

  return (
    <>
      <div className="relative group">
        <div
          ref={scrollRef}
          className="flex gap-2 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
        >
          {products.map((product, index) => (
            <div key={product.id} className="flex-shrink-0 w-[140px] sm:w-[200px] snap-start">
              <ProductCardCompact 
                product={product}
                onClick={() => setSelectedProduct(product)}
                categoryIndex={categoryIndices[product.categoryId]}
                showCategory={false}
                isInInitialViewport={index < visibleItemCount}
                loadingPriority={index}
              />
            </div>
          ))}
        </div>

        <button
          onClick={() => scroll('left')}
          className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black transition-all disabled:opacity-0"
          disabled={loading}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => scroll('right')}
          className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black transition-all disabled:opacity-0"
          disabled={loading}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {selectedProduct && (
        <ProductModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)}
          categoryIndex={categoryIndices[selectedProduct.categoryId]}
        />
      )}
    </>
  );
}