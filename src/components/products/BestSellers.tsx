import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCardCompact } from './ProductCardCompact';
import { ProductModal } from './ProductModal';
import { useBestSellers } from '../../hooks/useBestSellers';
import type { Product } from '../../types';

export function BestSellers() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { products, categoryIndices, loading } = useBestSellers(12);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const containerWidth = scrollRef.current.clientWidth;
    const scrollAmount = direction === 'left' ? -(containerWidth * 0.8) : containerWidth * 0.8;
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="relative">
        <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[140px] sm:w-[200px] aspect-[4/3] animate-pulse rounded-lg bg-gray-800"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative group">
        <div
          ref={scrollRef}
          className="flex gap-2 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
        >
          {products.map((product) => (
            <div key={product.id} className="flex-shrink-0 w-[140px] sm:w-[200px] snap-start">
              <ProductCardCompact 
                product={product}
                onClick={() => setSelectedProduct(product)}
                categoryIndex={categoryIndices[product.categoryId]}
                showCategory={false}
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