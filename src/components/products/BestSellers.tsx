import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ProductCardCompact } from './ProductCardCompact';
import { ProductModal } from './ProductModal';
import { useBestSellers } from '../../hooks/useBestSellers';
import { BestSellersSkeleton } from '../ui/Skeletons';
import type { Product as VariantsProduct } from '../../types/variants';
import { useCurrency } from '../../contexts/CurrencyContext';
import { preloadPageResources, prefetchGallery } from '../../lib/service-worker';
import { clearPreviewCache, isPreviewMode } from '../../utils/preview';
import SEO from '../SEO';

export function BestSellers() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { products: rawProducts, categoryIndices, loading } = useBestSellers(10);
  const [selectedProduct, setSelectedProduct] = useState<VariantsProduct | null>(null);
  const [visibleItemCount, setVisibleItemCount] = useState(3); // Default to mobile
  const [contentLoaded, setContentLoaded] = useState(false);
  const initialLoadTimeoutRef = useRef<NodeJS.Timeout>();
  const { currency } = useCurrency();
  const location = useLocation();
  
  // Track preview mode state to detect changes
  const [previewMode] = useState(() => isPreviewMode());
  
  // Detect if preview mode has changed during the session
  useEffect(() => {
    const currentPreviewMode = isPreviewMode();
    if (currentPreviewMode !== previewMode) {
      // Preview mode has changed, need to reload the page to ensure proper state
      window.location.reload();
    }
  }, [previewMode]);

  // Ensure products have all required properties for VariantsProduct
  const products = rawProducts.map(product => ({
    ...product,
    visible: product.visible === undefined ? true : product.visible // Ensure visible is defined
  })) as unknown as VariantsProduct[];

  // Preload resources for best sellers products
  useEffect(() => {
    if (products.length > 0) {
      // Tell service worker to preload best sellers resources
      preloadPageResources('collection', 'best-sellers');
      
      // Preload first few product images for better performance
      products.slice(0, 6).forEach((product, index) => {
        if (product.imageUrl) {
          const img = new Image();
          img.src = product.imageUrl;
          img.fetchPriority = index < 3 ? 'high' : 'auto';
          img.crossOrigin = 'anonymous';
        }
        
        // Preload product gallery images if available
        if (product.images && product.images.length > 0) {
          prefetchGallery(product.id, [...product.images], 0);
        }
      });
    }
  }, [products]);

  // Mark content as loaded after a brief delay for smooth transition
  useEffect(() => {
    if (!loading && products.length > 0 && !contentLoaded) {
      initialLoadTimeoutRef.current = setTimeout(() => {
        setContentLoaded(true);
      }, 150);

      return () => {
        if (initialLoadTimeoutRef.current) {
          clearTimeout(initialLoadTimeoutRef.current);
        }
      };
    }
  }, [loading, products, contentLoaded, currency]);

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

  // Handle product selection
  const handleProductClick = (product: VariantsProduct) => {
    setSelectedProduct(product);
  };

  // Handle modal close with proper navigation state management
  const handleModalClose = async () => {
    // Check current preview mode state
    const currentPreviewMode = isPreviewMode();
    
    // For preview mode changes, we need to be more careful about cache and state
    if (currentPreviewMode !== previewMode) {
      // Preview mode has changed since the best sellers was loaded
      // Clear cache and force a full page reload to ensure clean state
      await clearPreviewCache();
      window.location.reload();
      return;
    }

    // Normal close - just close the modal
    setSelectedProduct(null);
  };

  // Render the modal using a portal at the root level
  const renderModal = () => {
    if (!selectedProduct) return null;
    
    return createPortal(
      <ProductModal 
        product={selectedProduct} 
        onClose={handleModalClose}
        categoryIndex={categoryIndices[selectedProduct.categoryId] || 0}
        loading={loading}
      />,
      document.body // Render directly to the body
    );
  };

  if (loading && !contentLoaded) {
    return <BestSellersSkeleton />;
  }

  // Get SEO data for best sellers
  const bestSellersTitle = "Best Sellers | store.fun";
  const bestSellersDescription = "Discover our most popular products. Shop the best sellers from our curated collection.";
  const bestSellersImage = products.length > 0 ? products[0].imageUrl : '';

  return (
    <>
      <SEO 
        title={bestSellersTitle}
        description={bestSellersDescription}
        image={bestSellersImage}
        type="collection"
      />
      <div className={`relative group ${contentLoaded ? 'content-fade-in' : 'opacity-0'}`}>
        <div
          ref={scrollRef}
          className="flex gap-1.5 sm:gap-2 md:gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
        >
          {products.map((product, index) => (
            <div 
              key={product.id} 
              className="flex-shrink-0 w-[140px] sm:w-[200px] snap-start"
            >
              <ProductCardCompact 
                product={product}
                onClick={handleProductClick}
                categoryIndex={categoryIndices[product.categoryId]}
                showCategory={false}
                isInInitialViewport={index < visibleItemCount}
                loadingPriority={index}
                collectionMerchantTier={product.collectionOwnerMerchantTier}
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

      {/* Render modal through portal instead of directly */}
      {renderModal()}
    </>
  );
}