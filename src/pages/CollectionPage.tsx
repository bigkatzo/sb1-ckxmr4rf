import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import { CategoryTabs } from '../components/collections/CategoryTabs';
import { ProductGrid } from '../components/products/ProductGrid';
import { useCollection } from '../hooks/useCollection';
import { Clock, Image as ImageIcon, Ban } from 'lucide-react';
import { CountdownTimer } from '../components/ui/CountdownTimer';
import { CollectionSkeleton } from '../components/ui/Skeletons';
import { CollectionNotFound } from '../components/collections/CollectionNotFound';
import { createCategoryIndices } from '../utils/category-mapping';
import { OptimizedImage } from '../components/ui/OptimizedImage';
import type { Category, Product } from '../types/index';

export function CollectionPage() {
  const { slug } = useParams();
  const location = useLocation();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);
  const prevRouteRef = useRef<string>('');
  
  const { collection, loading, error } = useCollection(slug || '');
  
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
  
  // Get selected category from URL or state
  const [selectedCategory, setSelectedCategory] = useState<string>(
    // Initialize with the selectedCategoryId from location state if available
    location.state?.selectedCategoryId || ''
  );
  
  // Create category indices for consistent colors
  const categoryIndices = createCategoryIndices(categories);

  // Handle category change by updating state
  const handleCategoryChange = useCallback((categoryId: string) => {
    if (selectedCategory === categoryId) {
      // Clicking the same category again deselects it, showing all products
      setSelectedCategory('');
    } else {
      setSelectedCategory(categoryId);
    }
  }, [selectedCategory]);
  
  // Handle initial load and scroll restoration
  useEffect(() => {
    if (!loading && isInitialLoad) {
      setIsInitialLoad(false);
      
      // Only restore scroll position if returning directly from a product
      if (location.state?.returnedFromProduct && location.state?.scrollPosition) {
        setTimeout(() => {
          window.scrollTo({
            top: location.state.scrollPosition,
            behavior: 'auto'
          });
        }, 100);
      }
      
      // Set selected category from location state if available
      if (location.state?.selectedCategoryId) {
        setSelectedCategory(location.state.selectedCategoryId);
      }
    }
  }, [loading, isInitialLoad, location.state]);
  
  // Update selectedCategory when location state changes
  useEffect(() => {
    if (location.state?.selectedCategoryId) {
      setSelectedCategory(location.state.selectedCategoryId);
    }
  }, [location.state?.selectedCategoryId]);
  
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

  // Filter products to only show those in visible categories
  const visibleProducts = collection?.products?.filter((product: Product) => 
    !product.categoryId || // Include products without a category
    categories.some((cat: Category) => cat.id === product.categoryId) // Include products in visible categories
  ) || [];

  return (
    <div 
      ref={pageRef}
      className={`space-y-6 sm:space-y-8 ${loading && !isInitialLoad && !location.state?.returnedFromProduct ? 'opacity-60' : ''}`}
    >
      {/* Only show skeleton on initial load */}
      {loading && isInitialLoad ? (
        <CollectionSkeleton />
      ) : (
        <>
          {/* Hero Section */}
          <div className="relative aspect-[21/9] overflow-hidden rounded-xl sm:rounded-2xl">
            {collection.imageUrl ? (
              <OptimizedImage
                src={collection.imageUrl}
                alt={collection.name}
                width={1920}
                height={820}
                quality={85}
                className="absolute inset-0 h-full w-full object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1920px"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <ImageIcon className="h-16 w-16 text-gray-600" />
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
              {/* Status Tags */}
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 md:top-8 md:left-8 flex flex-col gap-2">
                {isUpcoming ? (
                  <>
                    {/* Desktop/Tablet: Combined tag */}
                    <div className="hidden sm:flex items-center gap-2 bg-purple-500/90 backdrop-blur-sm text-white px-3 py-1.5 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-2xl">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-sm sm:text-base font-medium">Coming Soon</span>
                      <span className="mx-2 w-px h-5 bg-white/30" />
                      <CountdownTimer
                        targetDate={collection.launchDate}
                        className="text-sm sm:text-base text-purple-200"
                      />
                    </div>
                    {/* Mobile: Side by side tags */}
                    <div className="sm:hidden flex items-center gap-1.5">
                      <div className="flex items-center gap-1.5 bg-purple-500/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-xl">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">Coming Soon</span>
                      </div>
                      <CountdownTimer
                        targetDate={collection.launchDate}
                        className="text-xs text-purple-400 bg-black/50 px-2.5 py-1 rounded-lg backdrop-blur-sm"
                      />
                    </div>
                  </>
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
                  <div className="flex items-center gap-2 bg-purple-500/90 backdrop-blur-sm text-white px-2.5 py-1 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-xl sm:rounded-2xl">
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
              </div>
            </div>
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
                  products={visibleProducts}
                  categoryId={selectedCategory}
                  categoryIndices={categoryIndices}
                  loading={loading && !isInitialLoad && !location.state?.returnedFromProduct}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}