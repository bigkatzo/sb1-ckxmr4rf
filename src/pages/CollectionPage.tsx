import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Navigate, useLocation, Link } from 'react-router-dom';
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
import { CollectionBadge } from '../components/ui/CollectionBadge';
import { ShareButton } from '../components/ui/ShareButton';
import type { Category, Product } from '../types/index';
import SEO from '../components/SEO';
import { preloadPageResources } from '../lib/service-worker';
import { CollectionLinks } from '../components/collections/CollectionLinks';

// Helper to prefetch a page by creating a hidden link and triggering a prefetch
const prefetchPage = (url: string) => {
  // Only run in browsers with support for prefetch
  if (!('IntersectionObserver' in window)) return;
  
  // Create a temporary link to enable prefetching
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = 'document';
  
  // Add link to head and clean up after prefetch completes
  document.head.appendChild(link);
  
  // Remove link after a few seconds
  setTimeout(() => {
    if (document.head.contains(link)) {
      document.head.removeChild(link);
    }
  }, 5000);
};

export function CollectionPage() {
  const { slug } = useParams();
  const location = useLocation();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const pageRef = useRef<HTMLDivElement>(null);
  const prevRouteRef = useRef<string>('');
  const loaderRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const hasAddedPrefetchLinks = useRef(false);
  const lastCategoryIdRef = useRef<string>('');
  
  // Add sort state with default sort option "recommended"
  const [sortOption, setSortOption] = useState<'recommended' | 'popular' | 'newest' | 'price'>('recommended');
  
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
    initialLimit: 16, // Increased from 12 for faster initial load
    loadMoreCount: 12,
    preloadThreshold: 0.3, // Start preloading when 30% away from bottom
    cacheKey: slug || '', // Use slug as cache key for persistence
  }, sortOption);
  
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
        
        // Check if we've visited this collection before
        const storedStateJson = sessionStorage.getItem(`collection_${slug}_state`);
        const hasVisitedBefore = sessionStorage.getItem(`collection_${slug}_visited`);
        
        // If we're returning to a recently visited collection, try to restore a larger initial batch
        if (hasVisitedBefore && storedStateJson) {
          try {
            const storedState = JSON.parse(storedStateJson);
            const isRecent = Date.now() - storedState.timestamp < 30 * 60 * 1000; // 30 minute expiry
            
            if (isRecent && storedState.loadedProductCount > 12) {
              // If we have a cached state with more products, load more products upfront
              // for a smoother experience rather than waiting for infinite scroll
              resetProducts();
              
              // Preload more products after a brief delay to match the previous state
              setTimeout(() => {
                // Load more batches to approximately match previous state
                const additionalBatchesNeeded = Math.ceil((storedState.loadedProductCount - 12) / 8);
                
                // Load up to the previous amount of products, but with a limit to prevent 
                // excessive loading on slow connections (maximum 3 batches)
                for (let i = 0; i < Math.min(additionalBatchesNeeded, 3); i++) {
                  if (hasMore && !loadingMore) {
                    loadMore();
                  }
                }
              }, 200);
            } else {
              // Just do a normal reset if the cached state is not recent
              resetProducts();
            }
          } catch (err) {
            console.error('Error processing stored collection state:', err);
            resetProducts();
          }
        } else {
          // First visit to this collection, just reset to initial state
          resetProducts();
        }
        
        // Clear session storage for products count
        sessionStorage.removeItem('visibleProductCount');
        
        // Don't automatically scroll to products section on initial page load
        // This fixes the issue with automatic scrolling to products, especially on mobile
      }
      
      // Set selected category from location state if available
      if (location.state?.selectedCategoryId) {
        setSelectedCategory(location.state.selectedCategoryId);
      }
    }
  }, [loading, isInitialLoad, location.state, resetProducts, paginatedProducts.length, hasMore, loadingMore, loadMore, slug]);
  
  // Set up intersection observer for infinite scrolling
  useEffect(() => {
    if (!loaderRef.current || !hasMore) return;
    
    // Check if we've visited this collection before in this session
    // If so, don't set up infinite scroll for a smoother cached experience
    const hasVisitedBefore = sessionStorage.getItem(`collection_${slug}_visited`);
    
    // If we're returning to a collection we've seen before and it's not from a product page,
    // don't re-enable infinite scroll to maintain the current state
    if (hasVisitedBefore && !hasReturnedFromProduct.current && !location.state?.returnedFromProduct) {
      return; // Skip setting up the intersection observer for smoother navigation
    }
    
    // Mark this collection as visited for future navigation
    sessionStorage.setItem(`collection_${slug}_visited`, 'true');
    
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
  }, [hasMore, loadingMore, loadMore, hasReturnedFromProduct.current, slug, location.state]);

  // Handle product click to improve navigation smoothness
  const handleProductClick = useCallback((_product: Product, _scrollPosition: number) => {
    // Before navigating away, store current state in sessionStorage for quick recovery
    const currentState = {
      loadedProductCount: paginatedProducts.length,
      selectedCategory,
      timestamp: Date.now()
    };
    sessionStorage.setItem(`collection_${slug}_state`, JSON.stringify(currentState));
  }, [paginatedProducts.length, selectedCategory, slug]);
  
  // Pass this to the ProductGrid component
  const productClickHandler = useMemo(() => handleProductClick, [handleProductClick]);
  
  // Check for stored state on component mount
  useEffect(() => {
    if (!isInitialLoad || !slug) return;
    
    try {
      // Check if we have stored state that we can use for faster recovery
      const storedStateJson = sessionStorage.getItem(`collection_${slug}_state`);
      if (storedStateJson) {
        const storedState = JSON.parse(storedStateJson);
        const isRecent = Date.now() - storedState.timestamp < 5 * 60 * 1000; // 5 minute expiry
        
        if (isRecent && !location.state?.returnedFromProduct) {
          // If we're not returning from a product but have recent state,
          // we can use this for faster initial rendering
          if (storedState.selectedCategory) {
            setSelectedCategory(storedState.selectedCategory);
          }
        }
      }
    } catch (err) {
      console.error('Error restoring collection state:', err);
    }
  }, [isInitialLoad, slug, location.state]);
  
  // Clean transition effect for returning from product
  useEffect(() => {
    if (hasReturnedFromProduct.current && paginatedProducts.length > 0) {
      // Add a subtle transition effect when returning to make it feel smoother
      if (pageRef.current) {
        pageRef.current.style.opacity = '0.95';
        setTimeout(() => {
          if (pageRef.current) {
            pageRef.current.style.opacity = '1';
            pageRef.current.style.transition = 'opacity 150ms ease-in';
          }
        }, 50);
      }
    }
  }, [hasReturnedFromProduct.current, paginatedProducts.length]);
  
  // Use a throttled scroll handler to prevent jank
  const scrollTimeoutRef = useRef<number | null>(null);
  
  // Add smooth scrolling optimization
  useEffect(() => {
    if (!hasMore) return; // Nothing more to load, no need for optimization
    
    // Optimize scroll performance by adding will-change hint before scrolling
    const handleScrollStart = () => {
      if (pageRef.current) {
        pageRef.current.style.willChange = 'transform';
      }
      
      // Clear any existing timeout
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      
      // Reset will-change after scrolling stops
      scrollTimeoutRef.current = window.setTimeout(() => {
        if (pageRef.current) {
          pageRef.current.style.willChange = 'auto';
        }
        scrollTimeoutRef.current = null;
      }, 150);
    };
    
    window.addEventListener('scroll', handleScrollStart, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScrollStart);
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [hasMore]);
  
  // Preload images for faster navigation
  useEffect(() => {
    if (!paginatedProducts.length || hasReturnedFromProduct.current) return;
    
    // Preload product images for smoother navigation
    const preloadImages = () => {
      const imagesToPreload = paginatedProducts
        .slice(0, 8) // Only preload first 8 images
        .map(product => product.imageUrl)
        .filter(Boolean) as string[];
        
      imagesToPreload.forEach(imageUrl => {
        const img = new Image();
        img.src = imageUrl;
      });
    };
    
    // Delay preloading slightly to prioritize visible content first
    const timer = setTimeout(preloadImages, 300);
    return () => clearTimeout(timer);
  }, [paginatedProducts, hasReturnedFromProduct.current]);

  // Handle focus restoration when returning from product page
  useEffect(() => {
    if (hasReturnedFromProduct.current && paginatedProducts.length > 0) {
      // After scroll restoration completes, move focus appropriately
      const focusTimer = setTimeout(() => {
        // Find the first category tab if we have one selected
        if (selectedCategory) {
          const categoryTab = document.querySelector(`button[data-category-id="${selectedCategory}"]`);
          if (categoryTab) {
            (categoryTab as HTMLElement).focus({ preventScroll: true });
            return;
          }
        }
        
        // If no category tab to focus, set focus to the page container
        if (pageRef.current) {
          pageRef.current.setAttribute('tabindex', '-1');
          pageRef.current.focus({ preventScroll: true });
          // Remove tabindex after focus to prevent keyboard tab sequence issues
          setTimeout(() => {
            if (pageRef.current) {
              pageRef.current.removeAttribute('tabindex');
            }
          }, 100);
        }
      }, 200);
      
      return () => clearTimeout(focusTimer);
    }
  }, [hasReturnedFromProduct.current, paginatedProducts.length, selectedCategory]);

  // Predictive prefetching for likely next navigation
  useEffect(() => {
    if (!collection || !paginatedProducts.length || hasAddedPrefetchLinks.current) return;
    
    hasAddedPrefetchLinks.current = true;
    
    // Prefetch the first few products as they're likely navigation targets
    const productsToPrefetch = paginatedProducts.slice(0, Math.min(3, paginatedProducts.length));
    
    // Delay prefetching slightly to prioritize current page render
    setTimeout(() => {
      productsToPrefetch.forEach(product => {
        if (product.collectionSlug && product.slug) {
          prefetchPage(`/${product.collectionSlug}/${product.slug}`);
        }
      });
    }, 2000);
  }, [collection, paginatedProducts]);
  
  // Apply content-visibility optimization to improve rendering performance
  useEffect(() => {
    if (!mainContentRef.current || !paginatedProducts.length) return;
    
    // Use content-visibility: auto for off-screen content to improve rendering
    const products = mainContentRef.current.querySelectorAll('.product-card');
    if (!products.length || !('IntersectionObserver' in window)) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          // When product comes near viewport, remove content-visibility
          if (entry.isIntersecting) {
            entry.target.classList.remove('content-visibility-auto');
            // Once visible, no need to keep observing
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '300px' } // Start loading before item enters viewport
    );
    
    // Observe all product cards except the first visible ones
    products.forEach((product, index) => {
      const productElement = product as HTMLElement;
      if (index > 8) { // First 8 products don't need optimization
        productElement.classList.add('content-visibility-auto');
        observer.observe(productElement);
      }
    });
    
    return () => {
      products.forEach(product => {
        observer.unobserve(product);
      });
    };
  }, [paginatedProducts.length]);
  
  // Add navigation prediction based on scroll and mouse movement
  useEffect(() => {
    if (!paginatedProducts.length || hasReturnedFromProduct.current) return;
    
    let hoveredProduct: string | null = null;
    let hoverTime = 0;
    
    // Track product hover to predict navigation
    const handleProductHover = (e: MouseEvent) => {
      const productCard = (e.target as HTMLElement).closest('.product-card');
      if (!productCard) return;
      
      const productId = productCard.getAttribute('data-product-id');
      if (!productId) return;
      
      // New product hover
      if (hoveredProduct !== productId) {
        hoveredProduct = productId;
        hoverTime = Date.now();
        
        // If user hovers over a product for more than 1 second,
        // prefetch that product page
        setTimeout(() => {
          // Only prefetch if still hovering the same product
          if (hoveredProduct === productId && 
              Date.now() - hoverTime > 1000) {
            const product = paginatedProducts.find(p => p.id === productId);
            if (product && product.collectionSlug && product.slug) {
              prefetchPage(`/${product.collectionSlug}/${product.slug}`);
            }
          }
        }, 1000);
      }
    };
    
    document.addEventListener('mousemove', handleProductHover, { passive: true });
    
    return () => {
      document.removeEventListener('mousemove', handleProductHover);
    };
  }, [paginatedProducts, hasReturnedFromProduct.current]);
  
  // Reset state when products or category changes
  useEffect(() => {
    const categoryChanged = lastCategoryIdRef.current !== selectedCategory;
    
    // Update the last category ID
    lastCategoryIdRef.current = selectedCategory;
    
    // If category changed, we need to reset
    if (categoryChanged) {
      // Reset pagination
      resetProducts();
    } 
  }, [selectedCategory, resetProducts]);
  
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
      className={`space-y-2 sm:space-y-5 md:space-y-6 ${loading && !isInitialLoad && !location.state?.returnedFromProduct ? 'opacity-60' : ''}`}
      style={{ transition: 'opacity 150ms ease-out' }}
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
                <div className="flex items-center gap-2 bg-primary/90 backdrop-blur-sm text-white px-2.5 py-1 sm:px-4 sm:py-2 md:px-5 md:py-2.5 rounded-xl sm:rounded-2xl">
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
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white max-w-2xl">
                  {collection.name}
                </h1>
                <CollectionBadge 
                  merchantTier={collection.ownerMerchantTier} 
                  className="text-3xl sm:text-5xl md:text-6xl"
                  showTooltip={true}
                />
              </div>
              <p className="text-sm sm:text-base text-gray-300 max-w-xl line-clamp-2 sm:line-clamp-none">
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
              <>
                <CategoryTabs
                  categories={categories}
                  selectedId={selectedCategory}
                  onChange={handleCategoryChange}
                  categoryIndices={categoryIndices}
                />

                <div className="px-4 pt-4 flex justify-end">
                  <div className="flex items-center space-x-2">
                    <label htmlFor="sort-by" className="text-sm text-gray-400">
                      Sort by:
                    </label>
                    <select
                      id="sort-by"
                      value={sortOption}
                      onChange={(e) => {
                        const newSortOption = e.target.value as 'recommended' | 'popular' | 'newest' | 'price';
                        setSortOption(newSortOption);
                        // Only reset products if we're not already at the top of the list
                        if (window.scrollY > 0) {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className="bg-gray-800 text-white text-sm rounded-lg px-3 py-1.5 border border-gray-700 focus:ring-primary focus:border-primary"
                    >
                      <option value="recommended">Recommended</option>
                      <option value="popular">Best sellers</option>
                      <option value="newest">Newest</option>
                      <option value="price">Price: Low to High</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  <div 
                    ref={mainContentRef}
                    className="transition-opacity duration-200 ease-in-out"
                  >
                    <ProductGrid 
                      products={paginatedProducts}
                      categoryId={selectedCategory}
                      categoryIndices={categoryIndices}
                      loading={loading && !isInitialLoad && !location.state?.returnedFromProduct}
                      onProductClick={productClickHandler}
                    />
                    
                    {/* Loading indicator for infinite scroll */}
                    {(loadingMore || hasMore) && (
                      <div 
                        ref={loaderRef}
                        className={`flex justify-center py-2 w-full overflow-hidden transition-opacity duration-300 ${
                          // Make loader less visible for returning users to avoid distraction
                          hasReturnedFromProduct.current ? 'opacity-0' : loadingMore ? 'opacity-100' : 'opacity-0'
                        }`}
                        style={{ 
                          contain: 'layout size', 
                          height: loadingMore ? 'auto' : '4px',
                          overscrollBehavior: 'none',
                          transition: 'opacity 150ms ease-in-out'
                        }}
                      >
                        {loadingMore && (
                          <div className="flex flex-col items-center justify-center py-2">
                            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-current border-e-transparent align-[-0.125em] text-gray-500/50 motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                              <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
                            </div>
                            <span className="text-xs text-gray-500 mt-1">Loading more...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        // Placeholder for empty state
        <div className="text-center py-12 bg-gray-900 rounded-xl">
          <p className="text-gray-400">No collection data available.</p>
        </div>
      )}
      
      {/* Add invisible prefetch links for common navigations */}
      <div className="hidden">
        {collection && (
          <Link to="/" />
        )}
      </div>
    </div>
  );
}