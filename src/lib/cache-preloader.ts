import { supabase } from './supabase';
import { cacheManager, CACHE_DURATIONS } from './cache';
import { normalizeStorageUrl } from './storage';

/**
 * Preloads critical data into the cache for faster initial page load
 */
export async function preloadCriticalData() {
  try {
    // Preload featured collections (static data)
    const { data: featuredCollections } = await supabase.rpc('get_featured_collections');
    if (featuredCollections && Array.isArray(featuredCollections)) {
      // Cache the list of featured collections
      cacheManager.set(
        'featured_collections', 
        featuredCollections, 
        CACHE_DURATIONS.SEMI_DYNAMIC.TTL, 
        {
          staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
        }
      );
      
      // Cache each collection individually
      featuredCollections.forEach(collection => {
        // Cache static collection data
        const collectionStatic = {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          image_url: collection.image_url || '',
          imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
          slug: collection.slug,
        };
        
        cacheManager.set(
          `collection_static:${collection.id}`, 
          collectionStatic, 
          CACHE_DURATIONS.STATIC.TTL, 
          {
            staleTime: CACHE_DURATIONS.STATIC.STALE
          }
        );
        
        // Cache dynamic collection data
        const collectionDynamic = {
          launch_date: collection.launch_date,
          launchDate: new Date(collection.launch_date),
          featured: collection.featured,
          visible: collection.visible,
          sale_ended: collection.sale_ended,
          saleEnded: collection.sale_ended,
        };
        
        cacheManager.set(
          `collection_dynamic:${collection.id}`, 
          collectionDynamic, 
          CACHE_DURATIONS.SEMI_DYNAMIC.TTL, 
          {
            staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
          }
        );
        
        // Preload collection slug for faster navigation
        cacheManager.set(
          `collection_slug:${collection.slug}`,
          collection.id,
          CACHE_DURATIONS.STATIC.TTL,
          {
            staleTime: CACHE_DURATIONS.STATIC.STALE
          }
        );
      });
      
      // Preload collections overview data for faster home page and navigation
      cacheManager.set(
        'collections_overview',
        featuredCollections.map(collection => ({
          id: collection.id,
          name: collection.name,
          slug: collection.slug,
          imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
          featured: collection.featured,
        })),
        CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
        {
          staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
        }
      );
    }
    
    // Preload bestsellers (semi-dynamic data)
    const { data: bestSellers } = await supabase.rpc('get_best_sellers', { 
      p_limit: 6,
      p_sort_by: 'sales'
    });
    
    if (bestSellers && Array.isArray(bestSellers)) {
      // Transform and cache bestsellers
      const transformedProducts = bestSellers.map(product => {
        // Handle notes field
        const hasValidNotes = product.notes && typeof product.notes === 'object' && Object.keys(product.notes).length > 0;
        
        // Process free_notes
        const freeNotesValue = product.free_notes !== null ? String(product.free_notes || '') : '';
        
        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          price: product.price,
          imageUrl: product.images?.[0] ? normalizeStorageUrl(product.images[0]) : '',
          images: (product.images || []).map((img: string) => normalizeStorageUrl(img)),
          designFiles: (product.design_files || []).map((file: string) => normalizeStorageUrl(file)),
          categoryId: product.category_id,
          category: product.category_id ? {
            id: product.category_id,
            name: product.category_name,
            description: product.category_description,
            type: product.category_type,
            visible: true,
            saleEnded: product.category_sale_ended ?? false,
            eligibilityRules: {
              groups: product.category_eligibility_rules?.groups || []
            }
          } : undefined,
          collectionId: product.collection_id,
          collectionName: product.collection_name,
          collectionSlug: product.collection_slug,
          collectionLaunchDate: product.collection_launch_date ? new Date(product.collection_launch_date) : undefined,
          collectionSaleEnded: product.collection_sale_ended ?? false,
          collectionUserId: product.collection_user_id,
          collectionOwnerMerchantTier: product.collection_owner_merchant_tier,
          categorySaleEnded: product.category_sale_ended ?? false,
          slug: product.slug || '',
          stock: product.quantity,
          minimumOrderQuantity: product.minimum_order_quantity || 50,
          variants: product.variants || [],
          variantPrices: product.variant_prices || {},
          priceModifierBeforeMin: product.price_modifier_before_min ?? null,
          priceModifierAfterMin: product.price_modifier_after_min ?? null,
          pinOrder: product.pin_order ?? null,
          blankCode: product.blank_code || '',
          technique: product.technique || '',
          noteForSupplier: product.note_for_supplier || '',
          saleEnded: product.sale_ended ?? false,
          salesCount: product.sales_count || 0,
          notes: hasValidNotes ? product.notes : undefined,
          freeNotes: freeNotesValue
        };
      });
      
      // Cache bestsellers list
      cacheManager.set(
        'bestsellers:6:sales', 
        { 
          products: transformedProducts,
          categoryIndices: {} // Will be computed when needed
        }, 
        CACHE_DURATIONS.SEMI_DYNAMIC.TTL, 
        {
          staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
        }
      );
      
      // Cache individual product data
      transformedProducts.forEach(product => {
        // Static product data
        const productStatic = {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          images: product.images,
          designFiles: product.designFiles,
          categoryId: product.categoryId,
          category: product.category,
          collectionId: product.collectionId,
          collectionName: product.collectionName,
          collectionSlug: product.collectionSlug,
          collectionUserId: product.collectionUserId,
          collectionOwnerMerchantTier: product.collectionOwnerMerchantTier,
          slug: product.slug,
          variants: product.variants,
          blankCode: product.blankCode,
          technique: product.technique,
          noteForSupplier: product.noteForSupplier,
        };
        
        cacheManager.set(
          `product_static:${product.id}`, 
          productStatic, 
          CACHE_DURATIONS.STATIC.TTL, 
          {
            staleTime: CACHE_DURATIONS.STATIC.STALE
          }
        );
        
        // Dynamic product data
        const productDynamic = {
          price: product.price,
          stock: product.stock,
          minimumOrderQuantity: product.minimumOrderQuantity,
          variantPrices: product.variantPrices,
          priceModifierBeforeMin: product.priceModifierBeforeMin,
          priceModifierAfterMin: product.priceModifierAfterMin,
          pinOrder: product.pinOrder,
        };
        
        cacheManager.set(
          `product_dynamic:${product.id}`, 
          productDynamic, 
          CACHE_DURATIONS.REALTIME.TTL, 
          {
            staleTime: CACHE_DURATIONS.REALTIME.STALE
          }
        );
        
        // Stock data
        cacheManager.set(
          `product_stock:${product.id}`, 
          product.stock, 
          CACHE_DURATIONS.REALTIME.TTL, 
          {
            staleTime: CACHE_DURATIONS.REALTIME.STALE
          }
        );
        
        // Price data
        cacheManager.set(
          `product_price:${product.id}`, 
          {
            basePrice: product.price,
            variantPrices: product.variantPrices,
            priceModifierBeforeMin: product.priceModifierBeforeMin,
            priceModifierAfterMin: product.priceModifierAfterMin,
          }, 
          CACHE_DURATIONS.REALTIME.TTL, 
          {
            staleTime: CACHE_DURATIONS.REALTIME.STALE
          }
        );
        
        // Cache product slug for faster navigation
        cacheManager.set(
          `product_slug:${product.collectionSlug}:${product.slug}`,
          product.id,
          CACHE_DURATIONS.STATIC.TTL,
          {
            staleTime: CACHE_DURATIONS.STATIC.STALE
          }
        );
      });
      
      // Cache product preview data for faster collection browsing
      const productPreviews = transformedProducts.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        slug: product.slug,
        collectionSlug: product.collectionSlug,
        stock: product.stock > 0
      }));
      
      cacheManager.set(
        'product_previews',
        productPreviews,
        CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
        {
          staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
        }
      );
    }
    
    // Preload navigation resources
    preloadNavigationResources();
    
    console.log('Cache preloaded successfully');
    return true;
  } catch (err) {
    console.error('Error preloading cache:', err);
    return false;
  }
}

/**
 * Preload frequently accessed navigation resources
 */
async function preloadNavigationResources() {
  try {
    // Preload routes configuration for faster routing
    const routeConfig = {
      home: '/',
      orders: '/orders',
      tracking: '/tracking',
      collections: {},
      legal: {
        privacy: '/privacy',
        terms: '/terms',
        returns: '/returns-faq'
      }
    };
    
    cacheManager.set(
      'route_config',
      routeConfig,
      CACHE_DURATIONS.STATIC.TTL,
      {
        staleTime: CACHE_DURATIONS.STATIC.STALE
      }
    );
    
    // Preload navigation link states
    cacheManager.set(
      'navigation_state',
      {
        lastVisited: null,
        frequentlyAccessed: []
      },
      CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
      {
        staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
      }
    );
    
  } catch (err) {
    console.error('Error preloading navigation resources:', err);
  }
}

// Define types for preloading
interface PreloadOptions {
  // Maximum number of images to preload at once
  maxConcurrent?: number;
  // Maximum amount of time (ms) to spend preloading
  timeout?: number;
  // Priority categories to preload (in order)
  categories?: Array<'lcp' | 'featured' | 'upcoming' | 'latest'>;
}

// Function to preload LCP images and critical resources
const preloadLCPImages = async () => {
  try {
    // Fetch featured collections - these likely contain LCP images
    const { data: featuredCollections } = await supabase
      .from('collections')
      .select('image_url')
      .eq('visible', true) 
      .eq('featured', true)
      .order('launch_date', { ascending: false })
      .limit(1);

    // If we have a featured collection, preload its image immediately
    if (featuredCollections && featuredCollections.length > 0) {
      const lcpImageUrl = featuredCollections[0].image_url;
      
      if (lcpImageUrl) {
        // Optimize image URL with size parameters for faster loading
        let optimizedLcpUrl = lcpImageUrl;
        if (lcpImageUrl.includes('/storage/v1/object/public/')) {
          // Convert to render endpoint with optimized size
          optimizedLcpUrl = lcpImageUrl
            .replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
            + '?width=1200&quality=80&format=webp&cache=604800';
        }
        
        // Aggressive preloading approach - add link tag right in the head ASAP
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = optimizedLcpUrl;
        link.fetchPriority = 'high';
        link.crossOrigin = 'anonymous'; // Add cross-origin support
        
        // Enable responsive loading hints
        link.setAttribute('imagesizes', '100vw');
        
        // Add to document head with highest priority
        document.head.prepend(link); // Use prepend instead of appendChild for higher priority
        
        // Also start loading the image in parallel for failsafe
        const img = new Image();
        img.src = optimizedLcpUrl;
        img.crossOrigin = 'anonymous';
        img.fetchPriority = 'high'; // Make sure to set high priority
        img.sizes = '100vw';
        
        // Add loading complete callback
        img.onload = () => {
          console.log('LCP image preloaded successfully');
          // Preload next image after first one loads
          setTimeout(() => {
            preloadNextImportantImage();
          }, 50); // Small delay to avoid competition with main resources
        };

        // Also try to create an in-memory cache of the image
        fetch(optimizedLcpUrl, { 
          mode: 'cors',
          priority: 'high',
          cache: 'force-cache',
          headers: {
            'Accept': 'image/*'
          }
        })
        .then(response => response.blob())
        .then(blob => {
          const objectURL = URL.createObjectURL(blob);
          const tempImg = new Image();
          tempImg.src = objectURL;
          tempImg.onload = () => URL.revokeObjectURL(objectURL);
        })
        .catch(err => console.warn('Failed to cache LCP image:', err));
      }
    }
  } catch (error) {
    console.error('Error preloading LCP images:', error);
  }
};

// Preload the next most important image (2nd featured collection)
const preloadNextImportantImage = async () => {
  try {
    // Fetch the second featured collection
    const { data: featuredCollections } = await supabase
      .from('collections')
      .select('image_url')
      .eq('visible', true)
      .eq('featured', true)
      .order('launch_date', { ascending: false })
      .range(1, 1);
    
    if (featuredCollections && featuredCollections.length > 0) {
      const nextImageUrl = featuredCollections[0].image_url;
      
      if (nextImageUrl) {
        // Optimize the URL similar to LCP image but with lower priority
        let optimizedUrl = nextImageUrl;
        if (nextImageUrl.includes('/storage/v1/object/public/')) {
          optimizedUrl = nextImageUrl
            .replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
            + '?width=1200&quality=75&format=webp&cache=604800';
        }
        
        // Preload with medium priority
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = optimizedUrl;
        link.fetchPriority = 'auto';
        link.crossOrigin = 'anonymous';
        
        document.head.appendChild(link);
      }
    }
  } catch (error) {
    console.error('Error preloading next important image:', error);
  }
};

/**
 * Set up cache preloader system
 * 
 * This module handles preloading of critical images and assets
 * to improve perceived performance
 */
export function setupCachePreloader(options: PreloadOptions = {}) {
  const {
    maxConcurrent = 2,
    timeout = 5000,
    categories = ['lcp', 'featured']
  } = options;
  
  // Track preloading state
  let isPreloading = false;
  let preloadTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
  // Begin preloading immediately for LCP
  if (typeof window !== 'undefined' && categories.includes('lcp')) {
    // Execute LCP preloading immediately without delay
    preloadLCPImages().catch(err => {
      console.warn('LCP preloading failed:', err);
    });
  }
  
  // Begin preloading for other resources with slight delay
  const startPreloading = async () => {
    if (isPreloading) return;
    
    isPreloading = true;
    
    // Set timeout to stop preloading after specified time
    preloadTimeoutId = setTimeout(() => {
      isPreloading = false;
    }, timeout);
    
    try {
      // Then preload featured collections if requested
      if (categories.includes('featured')) {
        // Fetch more featured collections
        const { data: featuredCollections } = await supabase
          .from('collections')
          .select('image_url')
          .eq('visible', true)
          .eq('featured', true)
          .order('launch_date', { ascending: false })
          .range(2, 2 + maxConcurrent);
          
        // Preload these with medium priority
        if (featuredCollections && featuredCollections.length > 0) {
          // Preload each image
          featuredCollections.forEach(collection => {
            if (collection.image_url) {
              const img = new Image();
              img.src = collection.image_url;
            }
          });
        }
      }
      
      // More preloading could be added here for other categories
      
    } catch (error) {
      console.error('Error in cache preloader:', error);
    } finally {
      isPreloading = false;
      if (preloadTimeoutId) {
        clearTimeout(preloadTimeoutId);
        preloadTimeoutId = null;
      }
    }
  };
  
  // Start preloading on page load
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback for the rest if available
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        startPreloading();
      }, { timeout: 2000 });
    } else {
      // Fallback to setTimeout
      setTimeout(() => {
        startPreloading();
      }, 500);
    }
    
    // Also preload on route changes
    window.addEventListener('popstate', () => {
      startPreloading();
    });
  }
  
  // Return cleanup function
  return () => {
    isPreloading = false;
    if (preloadTimeoutId) {
      clearTimeout(preloadTimeoutId);
      preloadTimeoutId = null;
    }
  };
} 