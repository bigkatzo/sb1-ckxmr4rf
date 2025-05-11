import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import { CategoryTabs } from '../components/collections/CategoryTabs';
import { ProductGrid } from '../components/products/ProductGrid';
import { useCollection } from '../hooks/useCollection';
import { usePaginatedProducts } from '../hooks/usePaginatedProducts';
import { Clock, Image as ImageIcon, Ban } from 'lucide-react';
import { CountdownTimer } from '../components/ui/CountdownTimer';
import { CollectionSkeleton } from '../components/ui/Skeletons';
import { CollectionNotFound } from '../components/collections/CollectionNotFound';
import { createCategoryIndices } from '../utils/category-mapping';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import { ShareButton } from '../components/ui/ShareButton';
import type { Category, Product } from '../types/index';
import SEO from '../components/SEO';
import { preloadPageResources } from '../lib/service-worker';
import { CollectionLinks } from '../components/collections/CollectionLinks';

export function CollectionPage() {
  const { slug } = useParams();
  const location = useLocation();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);
  const prevRouteRef = useRef<string>('');
  const loaderRef = useRef<HTMLDivElement>(null);
  
  const { collection, loading, error } = useCollection(slug || '');
  
  // Preload collection resources
  useEffect(() => {
    if (slug) {
      // Tell service worker to prioritize collection resources
      preloadPageResources('collection', slug);
    }
  }, [slug]);
  
  // Reset isInitialLoad when route parameters change or location changes
  useEffect(() => {
    // Check if the route has actually changed
    if (prevRouteRef.current !== slug) {
      setIsInitialLoad(true);
      prevRouteRef.current = slug || '';
    }
  }, [slug, location.key]);
  
  // Categories are already filtered by visibility in the public_categories view
  const categories = collection?.categories || [];
  
  // Create category indices for consistent colors
  const categoryIndices = createCategoryIndices(categories);
  
  // Get selected category from URL or state
  const [selectedCategory, setSelectedCategory] = useState<string>(
    // Initialize with the selectedCategoryId from location state if available
    location.state?.selectedCategoryId || ''
  );
  
  // Filter products to only show those in visible categories
  const visibleProducts = collection?.products?.filter((product: Product) => 
    !product.categoryId || // Include products without a category
    categories.some((cat: Category) => cat.id === product.categoryId) // Include products in visible categories
  ) || [];
  
  // Use paginated products hook for infinite scrolling
  const {
    products: paginatedProducts,
    loadingMore,
    hasMore,
    loadMore,
    resetProducts
  } = usePaginatedProducts(visibleProducts, selectedCategory, {
    initialLimit: 12,
    loadMoreCount: 8,
  });
  
  // Keep track of whether the user has returned from a product page
  const hasReturnedFromProduct = useRef(false);
  const hasScrolledAfterReturn = useRef(false);
  const restoredScrollPosition = useRef<number | null>(null);
  
  // Restore all visible products for returning users instead of just the initial batch
  useEffect(() => {
    if (hasReturnedFromProduct.current && location.state?.scrollPosition) {
      // If returning from a product, load enough products to fill the screen up to the previous scroll position
      const viewportHeight = window.innerHeight;
      const scrollPosition = location.state.scrollPosition;
      restoredScrollPosition.current = scrollPosition;
      
      // Calculate approximately how many products to load based on scroll position
      // Use a more aggressive loading strategy for returning users
      if (scrollPosition > viewportHeight) {
        // Load more batches if the user had scrolled far down
        const additionalBatches = Math.ceil(scrollPosition / (viewportHeight * 0.75));
        // Load up to 3 batches right away to ensure smooth return experience
        for (let i = 0; i < Math.min(additionalBatches, 3); i++) {
          if (hasMore && !loadingMore) {
            loadMore();
          }
        }
      }
    }
  }, [hasReturnedFromProduct.current, location.state?.scrollPosition, hasMore, loadingMore, loadMore]);
  
  // Re-enable infinite scroll after user scrolls
  useEffect(() => {
    // Only add scroll listener if returning from product
    if (!hasReturnedFromProduct.current) return;
    
    const handleScroll = () => {
      // Only trigger once after the first scroll
      if (!hasScrolledAfterReturn.current) {
        hasScrolledAfterReturn.current = true;
        // Re-enable infinite scrolling
        hasReturnedFromProduct.current = false;
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [hasReturnedFromProduct.current]);
  
  // Handle category change by updating state
  const handleCategoryChange = useCallback((categoryId: string) => {
    // Store the current scroll position when changing categories
    const scrollPosition = window.scrollY;
    
    // Reset the hasReturnedFromProduct flag when user manually changes category
    hasReturnedFromProduct.current = false;
    
    if (selectedCategory === categoryId) {
      // Clicking the same category again deselects it, showing all products
      setSelectedCategory('');
      resetProducts(); // Reset the pagination when deselecting a category
      
      // Scroll back to the top when category is deselected
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setSelectedCategory(categoryId);
      // The usePaginatedProducts hook will handle filtering by category
      
      // Remember this was a category change to improve restoration experience
      sessionStorage.setItem('lastCategoryChange', Date.now().toString());
    }
  }, [selectedCategory, resetProducts]);
  
  // Handle initial load and scroll restoration
  useEffect(() => {
    if (!loading && isInitialLoad) {
      setIsInitialLoad(false);
      
      // Check if returning from a product page
      if (location.state?.returnedFromProduct && location.state?.scrollPosition) {
        hasReturnedFromProduct.current = true;
        hasScrolledAfterReturn.current = false;
        
        // Preserve currently visible products
        sessionStorage.setItem('visibleProductCount', paginatedProducts.length.toString());
        
        // Restore scroll position with a short delay to allow rendering
        setTimeout(() => {
          window.scrollTo({
            top: location.state.scrollPosition,
            behavior: 'auto'
          });
          
          // After scroll restoration, check if we're near the end of loaded products
          // and preemptively load more if needed
          const scrollBottom = location.state.scrollPosition + window.innerHeight;
          const pageHeight = document.documentElement.scrollHeight;
          const nearBottom = (pageHeight - scrollBottom) < 500; // 500px threshold
          
          if (nearBottom && hasMore && !loadingMore) {
            // We're near the bottom, preload more products
            loadMore();
          }
        }, 100);
      } else {
        // Only reset products on initial visit, not when returning from product
        hasReturnedFromProduct.current = false;
        resetProducts();
        
        // Clear session storage for products count
        sessionStorage.removeItem('visibleProductCount');
      }
      
      // Set selected category from location state if available
      if (location.state?.selectedCategoryId) {
        setSelectedCategory(location.state.selectedCategoryId);
      }
    }
  }, [loading, isInitialLoad, location.state, resetProducts, paginatedProducts.length, hasMore, loadingMore, loadMore]);
  
  // Set up intersection observer for infinite scrolling
  useEffect(() => {
    if (!loaderRef.current || !hasMore) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    
    observer.observe(loaderRef.current);
    
    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [hasMore, loadingMore, loadMore, hasReturnedFromProduct.current]);

  if (!slug) {
    return <Navigate to="/" replace />;
  }

  // Don't show error state during loading - this was causing the "collection not found" flash
  if (!loading && (error || !collection)) {
    return <CollectionNotFound error={error || undefined} />;
  }

  // Always show skeleton during loading, regardless of initial or subsequent load
  if (loading && !collection) {
    return <CollectionSkeleton />;
  }
  
  // At this point we either have collection data or we're in a subsequent loading state
  const isUpcoming = collection?.launchDate ? collection.launchDate > new Date() : false;
  const isNew = collection?.launchDate && !isUpcoming 
    ? (new Date().getTime() - new Date(collection.launchDate).getTime() < 7 * 24 * 60 * 60 * 1000) 
    : false;

  return (
    <div 
      ref={pageRef}
      className={`space-y-4 sm:space-y-5 md:space-y-6 ${loading && !isInitialLoad && !location.state?.returnedFromProduct ? 'opacity-60' : ''}`}
    >
      {/* Only show skeleton on initial load */}
      {loading && isInitialLoad ? (
        <CollectionSkeleton />
      ) : collection ? (
        <>
          {/* Add SEO Component for collections */}
          <SEO 
            title={`${collection.name} | store.fun`}
            description={collection.description || `Explore ${collection.name} collection at store.fun`}
            image={collection.imageUrl || ''}
            collectionName={collection.name}
            type="collection"
            collection={collection}
          />

          {/* Hero Section */}
          <div className="relative aspect-[21/9] overflow-hidden rounded-xl sm:rounded-2xl">
            {collection.imageUrl ? (
              <OptimizedImage
                src={collection.imageUrl}
                alt={collection.name}
                width={1500}
                height={640}
                quality={80}
                className="absolute inset-0 h-full w-full object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1500px"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <ImageIcon className="h-16 w-16 text-gray-600" />
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            <div className="absolute top-4 right-4 z-10">
              <ShareButton 
                title={`${collection.name} | store.fun`}
                size="md"
                className="bg-black/50 hover:bg-black/70"
              />
            </div>

            <div className="absolute top-0 left-0 w-full p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              {isUpcoming ? (
                <div className="flex items-center gap-2 bg-purple-500/90 backdrop-blur-sm text-white px-2.5 py-1 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-xl sm:rounded-2xl">
                  <Clock className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  <CountdownTimer 
                    targetDate={collection.launchDate!} 
                    className="text-xs sm:text-base font-medium"
                  />
                </div>
              ) : collection.saleEnded ? (
                <div className="flex items-center gap-2 bg-red-500/90 backdrop-blur-sm text-white px-2.5 py-1 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-xl sm:rounded-2xl">
                  <Ban className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                  <span className="text-xs sm:text-base font-medium">Sale Ended</span>
                </div>
              ) : isNew ? (
                <div className="flex items-center gap-2 bg-green-500/90 backdrop-blur-sm text-white px-2.5 py-1 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-xl sm:rounded-2xl">
                  <span className="text-xs sm:text-base font-medium">New Drop</span>
                </div>
              ) : collection.featured ? (
                <div className="flex items-center gap-2 bg-secondary backdrop-blur-sm text-white px-2.5 py-1 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-xl sm:rounded-2xl">
                  <span className="text-xs sm:text-base font-medium">Featured Drop</span>
                </div>
              ) : null}
            </div>

            <div className="absolute bottom-0 w-full p-4 sm:p-8">
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white max-w-2xl">
                {collection.name}
              </h1>
              <p className="text-sm sm:text-base text-gray-300 max-w-xl mt-2 sm:mt-4 line-clamp-2 sm:line-clamp-none">
                {collection.description}
              </p>
              
              {/* Collection Links toggle button in hero */}
              <div className="collection-toggle">
                <CollectionLinks collection={collection} />
              </div>
            </div>
          </div>
          
          {/* Collection Links expanded content - Outside hero card */}
          <div className="collection-details">
            {/* Content will appear here when expanded */}
          </div>

          {/* Content Section */}
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg">
            {categories.length > 0 && (
              <CategoryTabs
                categories={categories}
                selectedId={selectedCategory}
                onChange={handleCategoryChange}
                categoryIndices={categoryIndices}
              />
            )}

            <div className="p-4 sm:p-6">
              <div className="transition-opacity duration-200 ease-in-out">
                <ProductGrid 
                  products={paginatedProducts}
                  categoryId={selectedCategory}
                  categoryIndices={categoryIndices}
                  loading={loading && !isInitialLoad && !location.state?.returnedFromProduct}
                />
                
                {/* Loading indicator for infinite scroll */}
                {(loadingMore || hasMore) && (
                  <div 
                    ref={loaderRef}
                    className={`flex justify-center py-4 transition-opacity duration-300 ${
                      // Make loader less visible for returning users to avoid distraction
                      hasReturnedFromProduct.current ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    {loadingMore && (
                      <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-current border-e-transparent align-[-0.125em] text-gray-500/50 motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                        <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        // Placeholder for empty state
        <div className="text-center py-12 bg-gray-900 rounded-xl">
          <p className="text-gray-400">No collection data available.</p>
        </div>
      )}
    </div>
  );
}